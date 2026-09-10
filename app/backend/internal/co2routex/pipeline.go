package co2routex

import (
	"context"
	"fmt"
	"math"
	"strings"

	"platform.local/common/pkg/models"
)

// Routing inputs.
type Inputs struct {
	Modes            []string          `json:"modes"`
	NetworkCountries []string          `json:"network_countries"`
	NetworkLayers    map[string]string `json:"network_layers"`
	RailwayCountry   string            `json:"railway_country"`
	RailwayLayer     string            `json:"railway_layer"`
	StationsLayer    string            `json:"stations_layer"`
	StationIDField   string            `json:"station_id_field"`
	StationNameField string            `json:"station_name_field"`
	StationRadiusKm  float64           `json:"station_radius_km"`
	CapacityTPerH    *float64          `json:"capacity_t_per_h,omitempty"`
	Raster           Upload            `json:"-"`
	Networks         []Upload          `json:"-"`
	Railway          Upload            `json:"-"`
	Stations         Upload            `json:"-"`
	Distances        Upload            `json:"-"`
}

func (in Inputs) Has(mode string) bool {
	for _, selected := range in.Modes {
		if selected == mode {
			return true
		}
	}
	return false
}

func present(file Upload) bool { return file.Path != "" || len(file.Data) > 0 }

func (in *Inputs) Validate() error {
	if len(in.Modes) == 0 {
		return fmt.Errorf("select at least one transport mode")
	}
	seen := map[string]bool{}
	for _, mode := range in.Modes {
		if (mode != "pipeline" && mode != "truck" && mode != "railway") || seen[mode] {
			return fmt.Errorf("invalid transport mode %q", mode)
		}
		seen[mode] = true
	}
	if in.CapacityTPerH != nil && (math.IsNaN(*in.CapacityTPerH) || math.IsInf(*in.CapacityTPerH, 0) || *in.CapacityTPerH < 18 || *in.CapacityTPerH > 4050) {
		return fmt.Errorf("pipeline capacity must be between 18 and 4050 t/h")
	}
	if in.Has("truck") && len(in.Networks) > 0 {
		if len(in.Networks) != len(in.NetworkCountries) {
			return fmt.Errorf("each road network needs a country code")
		}
		countries := map[string]bool{}
		for i, country := range in.NetworkCountries {
			country = strings.ToUpper(strings.TrimSpace(country))
			if !validCountry(country) || countries[country] {
				return fmt.Errorf("road network countries must be unique two-letter codes")
			}
			if !present(in.Networks[i]) {
				return fmt.Errorf("missing road network for %s", country)
			}
			in.NetworkCountries[i] = country
			countries[country] = true
		}
	}
	if in.Has("railway") && present(in.Stations) {
		in.RailwayCountry = strings.ToUpper(strings.TrimSpace(in.RailwayCountry))
		if !validCountry(in.RailwayCountry) {
			return fmt.Errorf("railway routing needs a two-letter country code")
		}
		if !present(in.Railway) && !present(in.Distances) {
			return fmt.Errorf("railway routing needs a railway network or station-distance CSV")
		}
		if in.StationRadiusKm == 0 {
			in.StationRadiusKm = 5
		}
		if math.IsNaN(in.StationRadiusKm) || math.IsInf(in.StationRadiusKm, 0) || in.StationRadiusKm <= 0 || in.StationRadiusKm > 100 {
			return fmt.Errorf("station search radius must be between 0 and 100 km")
		}
	}
	return nil
}

func validCountry(code string) bool {
	return len(code) == 2 && code[0] >= 'A' && code[0] <= 'Z' && code[1] >= 'A' && code[1] <= 'Z'
}

// Stage progress.
type StageResult struct {
	Stage string `json:"stage"`
	Job   *Job   `json:"job"`
}

type Progress func(StageResult) error

type Result struct {
	Routes   []models.CO2RouteXRoute `json:"routes"`
	Jobs     []StageResult           `json:"jobs"`
	Workbook []byte                  `json:"-"`
}

func (c *Client) Execute(ctx context.Context, workbook []byte, in Inputs, progress Progress) (*Result, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	result := &Result{Routes: []models.CO2RouteXRoute{}, Jobs: []StageResult{}}
	run := func(stage string, submit func() (*Job, error), output bool) (*Job, error) {
		job, err := submit()
		if err != nil {
			return nil, fmt.Errorf("%s: %w", stage, err)
		}
		if progress != nil {
			if err := progress(StageResult{stage, job}); err != nil {
				return nil, err
			}
		}
		job, err = c.Await(ctx, job)
		if err == nil && output {
			workbook, err = c.OutputWorkbook(ctx, job)
		}
		if err != nil {
			if job != nil {
				failed := *job
				detail := err.Error()
				failed.Status, failed.Error = "failed", &detail
				if progress != nil {
					_ = progress(StageResult{stage, &failed})
				}
			}
			return nil, fmt.Errorf("%s: %w", stage, err)
		}
		result.Jobs = append(result.Jobs, StageResult{stage, job})
		if progress != nil {
			if err := progress(StageResult{stage, job}); err != nil {
				return nil, err
			}
		}
		return job, nil
	}
	options := ConnectionOptions()
	options["mode_sheets"] = in.Modes
	if _, err := run(models.StageConnections, func() (*Job, error) { return c.GenerateConnections(ctx, workbook, options) }, true); err != nil {
		return result, err
	}
	if in.Has("pipeline") && present(in.Raster) {
		job, err := run(models.StageRoutingPipeline, func() (*Job, error) {
			return c.RoutePipeline(ctx, workbook, in.Raster, map[string]any{"mode_sheets": []string{"pipeline"}})
		}, true)
		if err != nil {
			return result, err
		}
		routes, err := ParsePipelineRoutes(workbook)
		if err != nil {
			return result, fmt.Errorf("pipeline results: %w", err)
		}
		for i := range routes {
			id := job.JobID
			routes[i].JobID = &id
		}
		result.Routes = append(result.Routes, routes...)
		workbook, err = routedMatrix(workbook, "pipeline", routes)
		if err != nil {
			return result, err
		}
	}
	if in.Has("truck") && len(in.Networks) > 0 {
		job, err := run(models.StageRoutingTruck, func() (*Job, error) {
			return c.RouteTruck(ctx, workbook, in.Networks, in.NetworkCountries, map[string]any{
				"network_layers":   in.NetworkLayers,
				"connection_rules": map[string]any{"candidate_source": "existing_nonzero"},
			})
		}, true)
		if err != nil {
			return result, err
		}
		routes, err := ParseTruckRoutes(job)
		if err != nil {
			return result, err
		}
		for i := range routes {
			id := job.JobID
			routes[i].JobID = &id
		}
		result.Routes = append(result.Routes, routes...)
	}
	if in.Has("railway") && present(in.Stations) {
		railOptions := map[string]any{"country_code": in.RailwayCountry}
		for key, value := range map[string]string{"stations_layer": in.StationsLayer, "station_id_field": in.StationIDField, "station_name_field": in.StationNameField} {
			if value != "" {
				railOptions[key] = value
			}
		}
		if !present(in.Distances) {
			if in.RailwayLayer != "" {
				railOptions["railway_layer"] = in.RailwayLayer
			}
			job, err := run(models.StageRoutingRailway, func() (*Job, error) {
				return c.RailwayStationDistances(ctx, in.Railway, in.Stations, railOptions)
			}, false)
			if err != nil {
				return result, err
			}
			name := "station_distances_" + in.RailwayCountry + ".csv"
			data, err := c.DownloadFile(ctx, job.JobID, name)
			if err != nil {
				return result, err
			}
			in.Distances = Upload{Name: name, Data: data}
		}
		delete(railOptions, "railway_layer")
		railOptions["maximum_search_radius_km"] = in.StationRadiusKm
		job, err := run(models.StageRoutingRailway, func() (*Job, error) {
			return c.RouteRailway(ctx, workbook, in.Stations, in.Distances, railOptions)
		}, true)
		if err != nil {
			return result, err
		}
		pairs, err := ParseMatrices(workbook)
		if err != nil {
			return result, err
		}
		for _, pair := range pairs {
			if pair.Mode != "railway" {
				continue
			}
			distance, id := pair.Value, job.JobID
			result.Routes = append(result.Routes, models.CO2RouteXRoute{Mode: "railway", FromNodeID: pair.FromID, ToNodeID: pair.ToID, DistanceKm: &distance, JobID: &id,
				Metadata: metadata(map[string]any{"status": "ok", "scope": "station_to_station", "selections": job.Summary["selections"]})})
		}
	}
	hasPipeline := false
	for _, route := range result.Routes {
		if route.Mode == "pipeline" && route.DistanceKm != nil && *route.DistanceKm > 0 {
			hasPipeline = true
		}
	}
	if hasPipeline {
		if _, err := run(models.StageCostsPipeline, func() (*Job, error) { return c.PipelineCosts(ctx, workbook, nil) }, true); err != nil {
			return result, err
		}
		if err := ApplyCosts(workbook, result.Routes, "pipeline", in.CapacityTPerH); err != nil {
			return result, err
		}
	}
	var modes []string
	for _, mode := range []string{"truck", "railway"} {
		if in.Has(mode) {
			modes = append(modes, mode)
		}
	}
	if len(modes) > 0 {
		if _, err := run(models.StageCostsContainer, func() (*Job, error) { return c.ContainerCosts(ctx, workbook, modes, nil) }, true); err != nil {
			return result, err
		}
		if err := ApplyCosts(workbook, result.Routes, "container", nil); err != nil {
			return result, err
		}
	}
	result.Workbook = workbook
	return result, nil
}
