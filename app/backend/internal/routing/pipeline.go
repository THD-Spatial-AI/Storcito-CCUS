// STORE_CO2 routing runs.
package routing

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
	"time"

	"gorm.io/datatypes"
	"platform.local/common/pkg/models"

	"spatialhub_backend/internal/storeco2"
)

// Upstream mode names.
var upstreamModes = map[string]string{"pipeline": "pipeline", "truck": "road", "railway": "rail"}

var stages = map[string]string{
	"pipeline": models.StageRoutingPipeline,
	"truck":    models.StageRoutingRoad,
	"railway":  models.StageRoutingRail,
}

// Run settings.
type Inputs struct {
	Modes    []string `json:"modes"`
	Optimize bool     `json:"optimize"`
}

func (in Inputs) Validate() error {
	if len(in.Modes) == 0 {
		return fmt.Errorf("select at least one transport mode")
	}
	seen := map[string]bool{}
	for _, mode := range in.Modes {
		if upstreamModes[mode] == "" || seen[mode] {
			return fmt.Errorf("invalid transport mode %q", mode)
		}
		seen[mode] = true
	}
	return nil
}

// Stage progress.
type Job struct {
	JobID   string         `json:"job_id"`
	Stage   string         `json:"stage"`
	Status  string         `json:"status"`
	Error   *string        `json:"error,omitempty"`
	Summary map[string]any `json:"summary,omitempty"`
}

// Progress update.
type StageResult struct {
	Stage string `json:"stage"`
	Job   *Job   `json:"job"`
}

type Progress func(StageResult) error

type Result struct {
	Routes []models.CO2RouteXRoute `json:"routes"`
	Jobs   []StageResult           `json:"jobs"`
	// Why not routed.
	Notes []string `json:"notes"`
}

// Runner drives STORE_CO2.
type Runner struct {
	store *storeco2.Client
	poll  time.Duration
}

func NewRunner(store *storeco2.Client) *Runner {
	return &Runner{store: store, poll: 250 * time.Millisecond}
}

// Routes each mode.
func (r *Runner) Execute(ctx context.Context, nodes []models.CO2Node, in Inputs, progress Progress) (*Result, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	if r.store == nil {
		return nil, fmt.Errorf("STORE_CO2 client is not configured")
	}
	result := &Result{Routes: []models.CO2RouteXRoute{}, Jobs: []StageResult{}, Notes: []string{}}
	available, err := r.store.RoutingModes(ctx)
	if err != nil {
		return result, fmt.Errorf("routing modes: %w", err)
	}

	ids := make([]string, 0, len(nodes))
	countries := map[string]bool{}
	byID := make(map[string]models.CO2Node, len(nodes))
	for _, node := range nodes {
		ids = append(ids, node.NodeID)
		byID[node.NodeID] = node
		if node.CountryCode != nil {
			countries[strings.ToUpper(*node.CountryCode)] = true
		}
	}

	seen := map[string]bool{}
	note := func(text string) {
		if !seen[text] {
			seen[text] = true
			result.Notes = append(result.Notes, text)
		}
	}
	for _, mode := range in.Modes {
		upstream := upstreamModes[mode]
		if !routable(available, countries, upstream) {
			note(mode + " routing is not available for the selected countries")
			continue
		}
		job, err := r.runMode(ctx, mode, ids, in.Optimize, progress, result)
		if err != nil {
			return result, err
		}
		result.Routes = append(result.Routes, convert(mode, job)...)
		for _, text := range jobNotes(mode, job, byID) {
			note(text)
		}
	}
	if len(result.Routes) == 0 {
		if len(result.Notes) > 0 {
			return result, fmt.Errorf("no routes produced: %s", strings.Join(result.Notes, "; "))
		}
		return result, fmt.Errorf("no routes produced: no emitter reached a selected sink")
	}
	return result, nil
}

// Server paths.
var storePath = regexp.MustCompile(` (of|in) /\S+`)

// Unrouted emitters, explained.
func jobNotes(mode string, job *storeco2.RoutingJob, nodes map[string]models.CO2Node) []string {
	name := func(id string) string {
		if node, ok := nodes[id]; ok && node.Name != "" {
			return node.Name
		}
		return id
	}
	var notes []string
	blocked := map[string]bool{}
	unknown := map[string]bool{}
	for _, reason := range job.Skipped {
		subject, detail, _ := strings.Cut(reason, ": ")
		switch {
		case detail == "not an emitter in the capture table":
			unknown[subject] = true
			notes = append(notes, name(subject)+": not in the STORE_CO2 capture table")
		case len(subject) == 2:
			blocked[strings.ToUpper(subject)] = true
			notes = append(notes, fmt.Sprintf("%s routing in %s: %s", mode, subject, storePath.ReplaceAllString(detail, "")))
		default:
			notes = append(notes, mode+" routing: "+storePath.ReplaceAllString(reason, ""))
		}
	}
	for _, route := range job.Routes {
		switch route.Status {
		case "unreachable":
			notes = append(notes, fmt.Sprintf("%s: no %s path to a selected sink", name(route.FromNodeID), mode))
		case "not_assigned":
			if job.Optimize {
				notes = append(notes, fmt.Sprintf("%s: left out by the sink-capacity assignment (%s)", name(route.FromNodeID), mode))
			} else {
				notes = append(notes, fmt.Sprintf("%s: not assigned a sink (%s)", name(route.FromNodeID), mode))
			}
		}
	}
	for _, id := range job.UnroutedEmitters {
		node := nodes[id]
		if unknown[id] || (node.CountryCode != nil && blocked[strings.ToUpper(*node.CountryCode)]) {
			continue
		}
		notes = append(notes, name(id)+": no capturable CO₂ in STORE_CO2")
	}
	return notes
}

func routable(available map[string][]string, countries map[string]bool, mode string) bool {
	for country := range countries {
		if slices.Contains(available[country], mode) {
			return true
		}
	}
	return false
}

func (r *Runner) runMode(ctx context.Context, mode string, ids []string, optimize bool, progress Progress, result *Result) (*storeco2.RoutingJob, error) {
	stage := stages[mode]
	report := func(job *storeco2.RoutingJob) error {
		if progress == nil {
			return nil
		}
		return progress(StageResult{stage, stageJob(stage, job)})
	}
	job, err := r.store.StartRouting(ctx, upstreamModes[mode], ids, optimize)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", stage, err)
	}
	if err := report(job); err != nil {
		return nil, err
	}
	last := job.Status
	for !job.Finished() {
		select {
		case <-ctx.Done():
			cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = r.store.CancelRouting(cleanup, job.JobID)
			cancel()
			return nil, ctx.Err()
		case <-time.After(r.poll):
		}
		next, err := r.store.RoutingRun(ctx, job.JobID)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", stage, err)
		}
		job = next
		if job.Status != last {
			last = job.Status
			if err := report(job); err != nil {
				return nil, err
			}
		}
	}
	result.Jobs = append(result.Jobs, StageResult{stage, stageJob(stage, job)})
	if job.Status == storeco2.RoutingFailed {
		detail := "routing failed"
		if job.Error != nil {
			detail = *job.Error
		}
		return nil, fmt.Errorf("%s: %s", stage, detail)
	}
	return job, nil
}

func stageJob(stage string, job *storeco2.RoutingJob) *Job {
	out := &Job{JobID: job.JobID, Stage: stage, Status: job.Status, Error: job.Error}
	if job.Finished() {
		assigned := 0
		for _, route := range job.Routes {
			if route.Status == "assigned" {
				assigned++
			}
		}
		out.Summary = map[string]any{
			"emitters": len(job.Routes), "assigned": assigned,
			"skipped": job.Skipped, "unrouted_emitters": job.UnroutedEmitters,
		}
	}
	return out
}

// Assigned routes.
func convert(mode string, job *storeco2.RoutingJob) []models.CO2RouteXRoute {
	routes := []models.CO2RouteXRoute{}
	for _, route := range job.Routes {
		if route.Status != "assigned" || route.ToNodeID == nil {
			continue
		}
		jobID := job.JobID
		row := models.CO2RouteXRoute{
			JobID:             &jobID,
			FromNodeID:        route.FromNodeID,
			ToNodeID:          *route.ToNodeID,
			Mode:              mode,
			DistanceKm:        finite(route.DistanceKm),
			AverageResistance: finite(route.AverageResistance),
		}
		meta := map[string]any{
			"status":       "ok",
			"source":       "store_co2",
			"country":      route.Country,
			"co2_t_per_yr": route.CO2TPerYr,
			"transport_km": route.TransportKm,
			"optimize":     job.Optimize,
		}
		if len(route.Geometry) > 0 && string(route.Geometry) != "null" {
			meta["geometry"] = route.Geometry
		}
		if route.Message != nil {
			meta["message"] = *route.Message
		}
		if costs := route.Costs; costs != nil {
			row.CostEurPerTKm = finite(costs.EurPerTKm)
			row.CapexEur = finite(costs.CapexEur)
			meta["annual_eur"] = costs.AnnualEur
			meta["eur_per_t"] = costs.EurPerT
			if mode != "pipeline" {
				// Chain-cost tariff.
				meta["gamma2_eur_per_t"] = costs.EurPerT
			} else {
				meta["outer_diameter_m"] = costs.OuterDiameterM
				meta["wall_m"] = costs.WallM
				meta["steel_grade"] = costs.SteelGrade
				meta["inlet_bar"] = costs.InletBar
				meta["boosters"] = costs.Boosters
				if route.CO2TPerYr != nil {
					// 8000 h/yr flow.
					meta["capacity_t_per_h"] = *route.CO2TPerYr / 8000
				}
			}
		}
		data, _ := json.Marshal(meta)
		row.Metadata = datatypes.JSON(data)
		routes = append(routes, row)
	}
	return routes
}

func finite(value *float64) *float64 {
	if value == nil || math.IsNaN(*value) || math.IsInf(*value, 0) {
		return nil
	}
	return value
}
