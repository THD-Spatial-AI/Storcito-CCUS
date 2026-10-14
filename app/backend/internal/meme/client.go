package meme

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Target is the solver backend MEME translates to.
const Target = "adopt-net0"

// Client calls MEME.
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// NewClient targets baseURL.
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 120 * time.Second},
	}
}

// Payload is the request body shared by validate, convert and simulate.
type Payload struct {
	APIKey     string         `json:"api_key,omitempty"`
	Model      map[string]any `json:"model"`
	Experiment map[string]any `json:"experiment"`
}

// Capabilities lists targets and their features.
type Capabilities struct {
	Features map[string]map[string]bool `json:"features"`
	Targets  []string                   `json:"targets"`
}

// Validation is the /validate verdict.
type Validation struct {
	Valid    bool     `json:"valid"`
	Error    string   `json:"error,omitempty"`
	Warnings []string `json:"warnings"`
}

// Submission acknowledges a queued job.
type Submission struct {
	ID       string   `json:"id"`
	State    string   `json:"state"`
	Warnings []string `json:"warnings"`
}

// Contract is the solver-independent result summary.
type Contract struct {
	Success              bool           `json:"success"`
	Framework            string         `json:"framework"`
	TerminationCondition string         `json:"termination_condition"`
	Objective            float64        `json:"objective"`
	Capacities           map[string]any `json:"capacities"`
	Dispatch             map[string]any `json:"dispatch"`
	TransmissionFlow     map[string]any `json:"transmission_flow"`
	CostsByTech          map[string]any `json:"costs_by_tech"`
	CostsByLocation      map[string]any `json:"costs_by_location"`
}

// Run is one expanded run of a job.
type Run struct {
	Index    int       `json:"index"`
	ExitCode int       `json:"exit_code"`
	Contract *Contract `json:"contract"`
}

// Job is the /jobs/{id}/status document.
type Job struct {
	ID       string   `json:"id"`
	Target   string   `json:"target"`
	State    string   `json:"state"`
	Error    string   `json:"error,omitempty"`
	Warnings []string `json:"warnings"`
	Runs     []Run    `json:"runs"`
	Created  string   `json:"created"`
	Started  string   `json:"started"`
	Finished string   `json:"finished"`
}

// Job states reported by MEME.
const (
	StateQueued    = "queued"
	StateRunning   = "running"
	StateSucceeded = "succeeded"
	StateFailed    = "failed"
)

// IsFinished reports a terminal state.
func (j Job) IsFinished() bool { return j.State != StateQueued && j.State != StateRunning }

// Capabilities probes the API.
func (c *Client) Capabilities(ctx context.Context) (*Capabilities, error) {
	var out Capabilities
	if err := c.do(ctx, http.MethodGet, "/capabilities", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Validate checks a payload without running it. A rejected payload is a
// verdict, not an error.
func (c *Client) Validate(ctx context.Context, p Payload) (*Validation, error) {
	var out Validation
	err := c.do(ctx, http.MethodPost, "/validate?target="+url.QueryEscape(Target), c.withKey(p), &out)
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.Status == http.StatusUnprocessableEntity {
		return &Validation{Valid: false, Error: apiErr.Message}, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// Simulate queues a job.
func (c *Client) Simulate(ctx context.Context, p Payload) (*Submission, error) {
	var out Submission
	if err := c.do(ctx, http.MethodPost, "/simulate?target="+url.QueryEscape(Target), c.withKey(p), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Status reads a job.
func (c *Client) Status(ctx context.Context, id string) (*Job, error) {
	var out Job
	if err := c.do(ctx, http.MethodGet, "/jobs/"+url.PathEscape(id)+"/status", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Result streams the result bundle (zip). The caller closes the body.
func (c *Client) Result(ctx context.Context, id string) (io.ReadCloser, error) {
	resp, err := c.send(ctx, http.MethodGet, "/jobs/"+url.PathEscape(id), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, readAPIError(resp)
	}
	return resp.Body, nil
}

func (c *Client) withKey(p Payload) Payload {
	if p.APIKey == "" {
		p.APIKey = c.apiKey
	}
	return p
}

// APIError is a non-2xx answer.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string { return fmt.Sprintf("MEME returned %d: %s", e.Status, e.Message) }

func readAPIError(resp *http.Response) error {
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var body struct {
		Error string `json:"error"`
	}
	msg := strings.TrimSpace(string(raw))
	if json.Unmarshal(raw, &body) == nil && body.Error != "" {
		msg = body.Error
	}
	return &APIError{Status: resp.StatusCode, Message: msg}
}

func (c *Client) send(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.http.Do(req)
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	resp, err := c.send(ctx, method, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
