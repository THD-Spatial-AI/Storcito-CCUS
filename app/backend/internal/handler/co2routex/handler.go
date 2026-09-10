package co2routex

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"platform.local/common/pkg/httputil"
	"platform.local/common/pkg/models"
	client "spatialhub_backend/internal/co2routex"
)

const runTimeout = 30 * time.Minute

// Runs CO2RouteX.
type Handler struct {
	db   *gorm.DB
	api  *client.Client
	mu   sync.Mutex
	runs map[string]*runState
}

type runState struct {
	ID       string                  `json:"run_id"`
	Status   string                  `json:"status"`
	Error    string                  `json:"error,omitempty"`
	Jobs     []client.StageResult    `json:"jobs"`
	Routes   []models.CO2RouteXRoute `json:"routes"`
	owner    string
	modelID  uint
	created  time.Time
	cancel   context.CancelFunc
	workbook []byte
}

func NewHandler(db *gorm.DB, api *client.Client) *Handler {
	return &Handler{db: db, api: api, runs: map[string]*runState{}}
}

func (h *Handler) Run(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		httputil.BadRequest(c, "Invalid model id")
		return
	}
	h.start(c, uint(id))
}

func (h *Handler) Preview(c *gin.Context) { h.start(c, 0) }

func (h *Handler) start(c *gin.Context, modelID uint) {
	owner, ok := httputil.MustGetUserID(c)
	if !ok {
		return
	}
	req, directory, err := readRequest(c)
	if err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}
	keep := false
	defer func() {
		if !keep {
			_ = os.RemoveAll(directory)
		}
	}()
	nodes, err := h.loadNodes(req.NodeIDs)
	if err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}
	workbook, err := client.BuildWorkbook(nodes)
	if err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}

	h.mu.Lock()
	for id, active := range h.runs {
		if active.Status != "running" && time.Since(active.created) > time.Hour {
			delete(h.runs, id)
			continue
		}
		if active.Status == "running" && (active.owner == owner || (modelID != 0 && active.modelID == modelID)) {
			h.mu.Unlock()
			c.JSON(http.StatusConflict, gin.H{"error": "A CO2RouteX run is already active"})
			return
		}
	}
	active := 0
	for _, run := range h.runs {
		if run.Status == "running" {
			active++
		}
	}
	if active >= 4 {
		h.mu.Unlock()
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Routing is busy; try again shortly"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	state := &runState{ID: uuid.NewString(), Status: "running", Jobs: []client.StageResult{}, Routes: []models.CO2RouteXRoute{}, owner: owner, modelID: modelID, created: time.Now(), cancel: cancel}
	h.runs[state.ID] = state
	h.mu.Unlock()
	keep = true
	c.JSON(http.StatusAccepted, gin.H{"success": true, "data": gin.H{"run_id": state.ID, "status": "running", "jobs": []client.StageResult{}, "routes": []models.CO2RouteXRoute{}}})
	go h.execute(ctx, state, workbook, req.Inputs, directory)
}

func (h *Handler) execute(ctx context.Context, state *runState, workbook []byte, in client.Inputs, directory string) {
	defer state.cancel()
	defer func() { _ = os.RemoveAll(directory) }()
	records := map[string]*models.CO2RouteXJob{}
	progress := func(update client.StageResult) error {
		h.mu.Lock()
		found := false
		for i, existing := range state.Jobs {
			if existing.Job.JobID == update.Job.JobID {
				state.Jobs[i] = update
				found = true
				break
			}
		}
		if !found {
			state.Jobs = append(state.Jobs, update)
		}
		h.mu.Unlock()
		if state.modelID == 0 {
			return nil
		}
		record := records[update.Job.JobID]
		if record == nil {
			now := time.Now()
			record = &models.CO2RouteXJob{ModelID: state.modelID, JobID: update.Job.JobID, Stage: update.Stage, StartedAt: &now}
			records[update.Job.JobID] = record
		}
		record.Status, record.Error = update.Job.Status, update.Job.Error
		summary, err := json.Marshal(update.Job.Summary)
		if err != nil {
			return err
		}
		outputs, err := json.Marshal(update.Job.Outputs)
		if err != nil {
			return err
		}
		record.Summary, record.Outputs = datatypes.JSON(summary), datatypes.JSON(outputs)
		if record.IsFinished() {
			now := time.Now()
			record.FinishedAt = &now
		}
		if err := h.db.Save(record).Error; err != nil {
			return fmt.Errorf("save stage: %w", err)
		}
		return nil
	}
	result, err := h.api.Execute(ctx, workbook, in, progress)
	if err == nil {
		err = ctx.Err()
	}
	if err == nil && state.modelID != 0 {
		err = h.persist(ctx, state.modelID, result.Routes)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if result != nil {
		state.Routes, state.workbook = result.Routes, result.Workbook
	}
	if err != nil {
		state.Status, state.Error = "failed", err.Error()
	} else {
		state.Status = "completed"
	}
}

func (h *Handler) loadNodes(ids []uint) ([]models.CO2Node, error) {
	if len(ids) < 2 || len(ids) > 500 {
		return nil, fmt.Errorf("select between 2 and 500 nodes")
	}
	seen := map[uint]bool{}
	for _, id := range ids {
		if id == 0 || seen[id] {
			return nil, fmt.Errorf("selected node IDs must be unique")
		}
		seen[id] = true
	}
	var nodes []models.CO2Node
	if err := h.db.Where("id IN ?", ids).Order("node_id asc").Find(&nodes).Error; err != nil {
		return nil, fmt.Errorf("failed to load nodes: %w", err)
	}
	if len(nodes) != len(ids) {
		return nil, fmt.Errorf("some selected nodes were not found")
	}
	return nodes, nil
}

func (h *Handler) withRun(c *gin.Context, action func(*runState)) {
	owner, ok := httputil.MustGetUserID(c)
	if !ok {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	state := h.runs[c.Param("runID")]
	if state == nil || state.owner != owner {
		httputil.NotFound(c, "Routing run not found or expired")
		return
	}
	action(state)
}

func (h *Handler) Status(c *gin.Context) {
	h.withRun(c, func(state *runState) { httputil.SuccessResponse(c, state) })
}

func (h *Handler) Cancel(c *gin.Context) {
	h.withRun(c, func(state *runState) { state.cancel(); httputil.SuccessResponse(c, gin.H{"run_id": state.ID}) })
}

func (h *Handler) Workbook(c *gin.Context) {
	h.withRun(c, func(state *runState) {
		if state.Status != "completed" {
			httputil.BadRequest(c, "Routing has not completed")
			return
		}
		c.Header("Content-Disposition", `attachment; filename="co2routex_results.xlsx"`)
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", state.workbook)
	})
}

func (h *Handler) Routes(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		httputil.BadRequest(c, "Invalid model id")
		return
	}
	routes := []models.CO2RouteXRoute{}
	if err := h.db.Where("model_id = ?", id).Order("mode asc, from_node_id asc, to_node_id asc").Find(&routes).Error; err != nil {
		httputil.InternalError(c, "Failed to load routes")
		return
	}
	httputil.SuccessResponse(c, gin.H{"routes": routes})
}

func (h *Handler) persist(ctx context.Context, modelID uint, routes []models.CO2RouteXRoute) error {
	return h.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("model_id = ?", modelID).Delete(&models.CO2RouteXRoute{}).Error; err != nil {
			return err
		}
		for i := range routes {
			routes[i].ModelID = modelID
		}
		if len(routes) == 0 {
			return nil
		}
		return tx.CreateInBatches(&routes, 200).Error
	})
}
