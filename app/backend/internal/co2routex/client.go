package co2routex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client calls CO2RouteX.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient targets baseURL.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 120 * time.Second},
	}
}

// One produced file.
type OutputFile struct {
	Name      string `json:"name"`
	SizeBytes int64  `json:"size_bytes"`
}

// Job mirrors JobResponse.
type Job struct {
	JobID           string         `json:"job_id"`
	Stage           string         `json:"stage"`
	Status          string         `json:"status"`
	CreatedAt       string         `json:"created_at"`
	StartedAt       *string        `json:"started_at"`
	FinishedAt      *string        `json:"finished_at"`
	DurationSeconds *float64       `json:"duration_seconds"`
	Error           *string        `json:"error"`
	Summary         map[string]any `json:"summary"`
	Outputs         []OutputFile   `json:"outputs"`
}

// Health is liveness.
type Health struct {
	Status     string `json:"status"`
	Version    string `json:"version"`
	MaxWorkers int    `json:"max_workers"`
	ActiveJobs int    `json:"active_jobs"`
}

// Probe the API.
func (c *Client) Health(ctx context.Context) (*Health, error) {
	var out Health
	if err := c.getJSON(ctx, "/health", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Run stage one.
func (c *Client) GenerateConnections(ctx context.Context, workbook []byte, options map[string]any) (*Job, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("workbook", "node_metrics.xlsx")
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(workbook); err != nil {
		return nil, err
	}

	if len(options) > 0 {
		encoded, err := json.Marshal(options)
		if err != nil {
			return nil, err
		}
		if err := writer.WriteField("options", string(encoded)); err != nil {
			return nil, err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	return c.postJob(ctx, "/connections/generate", writer.FormDataContentType(), body)
}

// Poll a job.
func (c *Client) GetJob(ctx context.Context, jobID string) (*Job, error) {
	var job Job
	if err := c.getJSON(ctx, "/jobs/"+url.PathEscape(jobID), &job); err != nil {
		return nil, err
	}
	return &job, nil
}

// Fetch one output.
func (c *Client) DownloadFile(ctx context.Context, jobID, name string) ([]byte, error) {
	return c.fetch(ctx, "/jobs/"+url.PathEscape(jobID)+"/files/"+url.PathEscape(name))
}

// DownloadArchive fetches outputs.
func (c *Client) DownloadArchive(ctx context.Context, jobID string) ([]byte, error) {
	return c.fetch(ctx, "/jobs/"+url.PathEscape(jobID)+"/archive")
}

func (c *Client) fetch(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("co2routex unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, c.statusError(resp)
	}
	return io.ReadAll(resp.Body)
}

func (c *Client) postJob(ctx context.Context, path, contentType string, body io.Reader) (*Job, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("co2routex unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// 202 or 200.
	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		return nil, c.statusError(resp)
	}

	var job Job
	if err := json.NewDecoder(resp.Body).Decode(&job); err != nil {
		return nil, fmt.Errorf("invalid co2routex response: %w", err)
	}
	return &job, nil
}

func (c *Client) getJSON(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("co2routex unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return c.statusError(resp)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// statusError keeps detail.
func (c *Client) statusError(resp *http.Response) error {
	payload, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	detail := strings.TrimSpace(string(payload))
	if detail == "" {
		return fmt.Errorf("co2routex returned %s", resp.Status)
	}
	return fmt.Errorf("co2routex returned %s: %s", resp.Status, detail)
}
