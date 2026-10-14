package meme

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"platform.local/common/pkg/httputil"
	"platform.local/common/pkg/models"
	client "spatialhub_backend/internal/meme"
)

const (
	callTimeout = 30 * time.Second
	jobTTL      = 24 * time.Hour
	maxNodes    = 500
)

// Handler runs CCUS models through MEME.
type Handler struct {
	db   *gorm.DB
	api  *client.Client
	mu   sync.Mutex
	jobs map[string]jobOwner
}

type jobOwner struct {
	userID  string
	modelID uint
	created time.Time
}

func NewHandler(db *gorm.DB, api *client.Client) *Handler {
	return &Handler{db: db, api: api, jobs: map[string]jobOwner{}}
}

type runRequest struct {
	client.Options
}

// RunSummary is one solver run, without logs.
type RunSummary struct {
	Success              bool    `json:"success"`
	TerminationCondition string  `json:"termination_condition,omitempty"`
	Objective            float64 `json:"objective"`
	ExitCode             int     `json:"exit_code"`
}

// JobSummary is what the browser receives for a MEME job.
type JobSummary struct {
	JobID    string       `json:"job_id"`
	ModelID  uint         `json:"model_id"`
	State    string       `json:"state"`
	Error    string       `json:"error,omitempty"`
	Warnings []string     `json:"warnings"`
	Runs     []RunSummary `json:"runs"`
	Finished string       `json:"finished,omitempty"`
}

func summarise(job *client.Job, owner jobOwner) JobSummary {
	out := JobSummary{
		JobID: job.ID, ModelID: owner.modelID, State: job.State, Error: job.Error,
		Warnings: append([]string{}, job.Warnings...),
		Runs:     []RunSummary{}, Finished: job.Finished,
	}
	for _, run := range job.Runs {
		item := RunSummary{ExitCode: run.ExitCode}
		if run.Contract != nil {
			item.Success = run.Contract.Success
			item.TerminationCondition = run.Contract.TerminationCondition
			item.Objective = run.Contract.Objective
		}
		out.Runs = append(out.Runs, item)
	}
	return out
}

// Health reports whether MEME answers.
func (h *Handler) Health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), callTimeout)
	defer cancel()
	caps, err := h.api.Capabilities(ctx)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "MEME is unreachable"})
		return
	}
	httputil.SuccessResponse(c, gin.H{"targets": caps.Targets})
}

// Run builds a model from the nodes linked to the model, validates it with
// MEME and queues the simulation.
func (h *Handler) Run(c *gin.Context) {
	owner, ok := httputil.MustGetUserID(c)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		httputil.BadRequest(c, "Invalid model id")
		return
	}
	var req runRequest
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			httputil.BadRequest(c, "Invalid MEME run settings")
			return
		}
	}
	nodes, err := h.loadNodes(uint(id))
	if err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}
	payload, warnings, err := client.BuildCopperplate(fmt.Sprintf("ccus_model_%d", id), nodes, req.Options)
	if err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), callTimeout)
	defer cancel()
	verdict, err := h.api.Validate(ctx, payload)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "MEME is unreachable"})
		return
	}
	if !verdict.Valid {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "MEME rejected the model: " + verdict.Error})
		return
	}
	sub, err := h.api.Simulate(ctx, payload)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "MEME could not queue the simulation"})
		return
	}

	h.remember(sub.ID, jobOwner{userID: owner, modelID: uint(id), created: time.Now()})
	httputil.SuccessResponse(c, gin.H{
		"job_id": sub.ID, "state": sub.State,
		"warnings": append(warnings, sub.Warnings...),
	})
}

// Status reads a job the caller started.
func (h *Handler) Status(c *gin.Context) {
	owner, found := h.ownedJob(c)
	if !found {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), callTimeout)
	defer cancel()
	job, err := h.api.Status(ctx, c.Param("jobID"))
	if err != nil {
		h.upstreamError(c, err)
		return
	}
	httputil.SuccessResponse(c, summarise(job, owner))
}

// Result streams the result bundle of a finished job.
func (h *Handler) Result(c *gin.Context) {
	if _, found := h.ownedJob(c); !found {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()
	body, err := h.api.Result(ctx, c.Param("jobID"))
	if err != nil {
		h.upstreamError(c, err)
		return
	}
	defer body.Close()
	c.Header("Content-Disposition", `attachment; filename="meme_results.zip"`)
	c.Header("Content-Type", "application/zip")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, body)
}

func (h *Handler) upstreamError(c *gin.Context, err error) {
	var apiErr *client.APIError
	if errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound {
		httputil.NotFound(c, "MEME job not found or expired")
		return
	}
	c.JSON(http.StatusBadGateway, gin.H{"error": "MEME request failed"})
}

func (h *Handler) loadNodes(modelID uint) ([]models.CO2Node, error) {
	var links []models.ModelCO2Node
	if err := h.db.Preload("Node").Where("model_id = ?", modelID).Order("id asc").Limit(maxNodes + 1).Find(&links).Error; err != nil {
		return nil, fmt.Errorf("failed to load model nodes")
	}
	if len(links) == 0 {
		return nil, fmt.Errorf("the model has no CO2 nodes")
	}
	if len(links) > maxNodes {
		return nil, fmt.Errorf("a MEME run supports at most %d nodes", maxNodes)
	}
	nodes := make([]models.CO2Node, 0, len(links))
	for _, link := range links {
		if link.Node != nil {
			nodes = append(nodes, *link.Node)
		}
	}
	return nodes, nil
}

func (h *Handler) remember(jobID string, owner jobOwner) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for id, old := range h.jobs {
		if time.Since(old.created) > jobTTL {
			delete(h.jobs, id)
		}
	}
	h.jobs[jobID] = owner
}

func (h *Handler) ownedJob(c *gin.Context) (jobOwner, bool) {
	user, ok := httputil.MustGetUserID(c)
	if !ok {
		return jobOwner{}, false
	}
	h.mu.Lock()
	owner, found := h.jobs[c.Param("jobID")]
	h.mu.Unlock()
	if !found || owner.userID != user {
		httputil.NotFound(c, "MEME job not found or expired")
		return jobOwner{}, false
	}
	return owner, true
}
