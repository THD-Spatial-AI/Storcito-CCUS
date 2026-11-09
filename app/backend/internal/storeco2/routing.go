package storeco2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// Routing job states.
const (
	RoutingQueued    = "queued"
	RoutingRunning   = "running"
	RoutingCompleted = "completed"
	RoutingFailed    = "failed"
)

// Route pricing.
type RoutingCosts struct {
	AnnualEur       *float64 `json:"annual_eur"`
	EurPerT         *float64 `json:"eur_per_t"`
	EurPerTKm       *float64 `json:"eur_per_t_km"`
	CapexEur        *float64 `json:"capex_eur"`
	FixedEurPerYr   *float64 `json:"fixed_eur_per_yr"`
	FlowEurPerT     *float64 `json:"flow_eur_per_t"`
	OuterDiameterM  *float64 `json:"outer_diameter_m"`
	WallM           *float64 `json:"wall_m"`
	SteelGrade      *string  `json:"steel_grade"`
	InletBar        *float64 `json:"inlet_bar"`
	Boosters        *int     `json:"boosters"`
	StationCapexEur *float64 `json:"station_capex_eur"`
}

// Emitter assignment.
type RoutingRoute struct {
	Mode              string          `json:"mode"`
	Country           string          `json:"country"`
	FromNodeID        string          `json:"from_node_id"`
	FromName          *string         `json:"from_name"`
	ToNodeID          *string         `json:"to_node_id"`
	ToName            *string         `json:"to_name"`
	SinkType          *string         `json:"sink_type"`
	Status            string          `json:"status"`
	CO2TPerYr         *float64        `json:"co2_t_per_yr"`
	DistanceKm        *float64        `json:"distance_km"`
	TransportKm       *float64        `json:"transport_km"`
	AverageResistance *float64        `json:"average_resistance"`
	Geometry          json.RawMessage `json:"geometry"`
	Costs             *RoutingCosts   `json:"costs"`
	Message           *string         `json:"message"`
}

// One run.
type RoutingJob struct {
	JobID            string         `json:"job_id"`
	Mode             string         `json:"mode"`
	Status           string         `json:"status"`
	Error            *string        `json:"error"`
	NodeCount        int            `json:"node_count"`
	Optimize         bool           `json:"optimize"`
	CreatedAt        float64        `json:"created_at"`
	StartedAt        *float64       `json:"started_at"`
	FinishedAt       *float64       `json:"finished_at"`
	Routes           []RoutingRoute `json:"routes"`
	Skipped          []string       `json:"skipped"`
	UnroutedEmitters []string       `json:"unrouted_emitters"`
}

// Finished is terminal.
func (j RoutingJob) Finished() bool {
	return j.Status == RoutingCompleted || j.Status == RoutingFailed
}

// Modes per country.
func (c *Client) RoutingModes(ctx context.Context) (map[string][]string, error) {
	var out struct {
		Countries map[string][]string `json:"countries"`
	}
	if err := c.getJSON(ctx, "/routing/modes", &out); err != nil {
		return nil, err
	}
	return out.Countries, nil
}

// Queues a run.
func (c *Client) StartRouting(ctx context.Context, mode string, nodeIDs []string, optimize bool) (*RoutingJob, error) {
	body, err := json.Marshal(map[string]any{"mode": mode, "node_ids": nodeIDs, "optimize": optimize})
	if err != nil {
		return nil, err
	}
	var job RoutingJob
	if err := c.send(ctx, http.MethodPost, "/routing/runs", body, &job); err != nil {
		return nil, err
	}
	return &job, nil
}

// Reads a run.
func (c *Client) RoutingRun(ctx context.Context, jobID string) (*RoutingJob, error) {
	var job RoutingJob
	if err := c.getJSON(ctx, "/routing/runs/"+url.PathEscape(jobID), &job); err != nil {
		return nil, err
	}
	return &job, nil
}

// Stops a run.
func (c *Client) CancelRouting(ctx context.Context, jobID string) error {
	return c.send(ctx, http.MethodDelete, "/routing/runs/"+url.PathEscape(jobID), nil, nil)
}

func (c *Client) send(ctx context.Context, method, path string, body []byte, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("store_co2 unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return responseError(resp)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
