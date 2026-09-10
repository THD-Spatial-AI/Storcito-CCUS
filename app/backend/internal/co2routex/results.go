package co2routex

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"gorm.io/datatypes"
	"platform.local/common/pkg/models"
)

func number(value any) *float64 {
	var v float64
	switch value := value.(type) {
	case float64:
		v = value
	case string:
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return nil
		}
		v = parsed
	default:
		return nil
	}
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return nil
	}
	return &v
}

func metadata(values map[string]any) datatypes.JSON {
	data, _ := json.Marshal(values)
	return datatypes.JSON(data)
}

func readTable(file *excelize.File, sheet string) ([]map[string]any, error) {
	rows, err := file.GetRows(sheet, excelize.Options{RawCellValue: true})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("missing headers in %s", sheet)
	}
	var out []map[string]any
	for _, row := range rows[1:] {
		values := map[string]any{}
		for i, cell := range row {
			if i < len(rows[0]) && cell != "" {
				key := strings.TrimSpace(rows[0][i])
				values[key] = cell
				if key != "from_id" && key != "to_id" {
					if n := number(cell); n != nil {
						values[key] = *n
					}
				}
			}
		}
		if len(values) > 0 {
			out = append(out, values)
		}
	}
	return out, nil
}

func routeKey(mode, from, to string) string { return mode + "\x00" + from + "\x00" + to }

func ParsePipelineRoutes(workbook []byte) ([]models.CO2RouteXRoute, error) {
	file, err := excelize.OpenReader(bytes.NewReader(workbook))
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	rows, err := readTable(file, "pipeline_route_metrics")
	if err != nil {
		return nil, err
	}
	routes := make([]models.CO2RouteXRoute, 0, len(rows))
	for _, row := range rows {
		from, _ := row["from_id"].(string)
		to, _ := row["to_id"].(string)
		if from == "" || to == "" {
			return nil, fmt.Errorf("pipeline output is missing route IDs")
		}
		route := models.CO2RouteXRoute{Mode: "pipeline", FromNodeID: from, ToNodeID: to, Metadata: metadata(row)}
		if row["status"] == "ok" {
			route.DistanceKm = number(row["distance_km"])
			route.AverageResistance = number(row["average_route_resistance"])
			if route.DistanceKm == nil || *route.DistanceKm < 0 {
				return nil, fmt.Errorf("invalid pipeline distance")
			}
		}
		routes = append(routes, route)
	}
	return routes, nil
}

func ParseTruckRoutes(job *Job) ([]models.CO2RouteXRoute, error) {
	rows, ok := job.Summary["routes"].([]any)
	if !ok {
		return nil, fmt.Errorf("missing truck route summary")
	}
	routes := make([]models.CO2RouteXRoute, 0, len(rows))
	for _, item := range rows {
		row, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("invalid truck route summary")
		}
		from, _ := row["from_id"].(string)
		to, _ := row["to_id"].(string)
		if from == "" || to == "" {
			return nil, fmt.Errorf("truck output is missing route IDs")
		}
		route := models.CO2RouteXRoute{Mode: "truck", FromNodeID: from, ToNodeID: to, Metadata: metadata(row)}
		if row["status"] == "success" {
			distance := number(row["metric_distance_m"])
			if distance == nil || *distance < 0 {
				return nil, fmt.Errorf("invalid truck distance")
			}
			km := *distance / 1000
			route.DistanceKm = &km
		}
		routes = append(routes, route)
	}
	return routes, nil
}

func ApplyCosts(workbook []byte, routes []models.CO2RouteXRoute, mode string, capacity *float64) error {
	file, err := excelize.OpenReader(bytes.NewReader(workbook))
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()
	sheet := "container_cost_coefficients"
	if mode == "pipeline" {
		sheet = "pipeline_route_metrics"
	}
	rows, err := readTable(file, sheet)
	if err != nil {
		return err
	}
	index := map[string]*models.CO2RouteXRoute{}
	covered := map[string]bool{}
	for i := range routes {
		index[routeKey(routes[i].Mode, routes[i].FromNodeID, routes[i].ToNodeID)] = &routes[i]
	}
	for _, row := range rows {
		from, _ := row["from_id"].(string)
		to, _ := row["to_id"].(string)
		rowMode, _ := row["mode"].(string)
		if mode == "pipeline" {
			rowMode = mode
		}
		route := index[routeKey(rowMode, from, to)]
		if route == nil || route.DistanceKm == nil {
			continue
		}
		covered[routeKey(rowMode, from, to)] = true
		values := map[string]any{}
		if err := json.Unmarshal(route.Metadata, &values); err != nil {
			return err
		}
		for key, value := range row {
			values[key] = value
		}
		if mode == "pipeline" {
			low, high := number(row["capacity_min_t_per_h"]), number(row["capacity_max_t_per_h"])
			slope, intercept := number(row["capex_spatial_slope_eur_per_t_per_h"]), number(row["capex_spatial_intercept_eur"])
			if low == nil || high == nil || slope == nil || intercept == nil {
				return fmt.Errorf("missing pipeline cost coefficients for %s -> %s", from, to)
			}
			values["capex_min_eur"] = *slope**low + *intercept
			values["capex_max_eur"] = *slope**high + *intercept
			if capacity != nil {
				if *capacity < *low || *capacity > *high {
					return fmt.Errorf("pipeline capacity must be between %g and %g t/h", *low, *high)
				}
				capex := *slope**capacity + *intercept
				if math.IsNaN(capex) || math.IsInf(capex, 0) || capex < 0 {
					return fmt.Errorf("invalid pipeline CAPEX")
				}
				route.CapexEur = &capex
				values["capacity_t_per_h"] = *capacity
			}
		} else {
			route.CostEurPerTKm = number(row["unit_cost_eur_per_t_km"])
			if route.CostEurPerTKm == nil || *route.CostEurPerTKm < 0 {
				return fmt.Errorf("invalid container unit cost")
			}
		}
		route.Metadata = metadata(values)
	}
	for _, route := range routes {
		if route.DistanceKm == nil || *route.DistanceKm <= 0 {
			continue
		}
		if (mode == "pipeline") != (route.Mode == "pipeline") {
			continue
		}
		if !covered[routeKey(route.Mode, route.FromNodeID, route.ToNodeID)] {
			return fmt.Errorf("missing costs for %s %s -> %s", route.Mode, route.FromNodeID, route.ToNodeID)
		}
	}
	return nil
}

func routedMatrix(workbook []byte, mode string, routes []models.CO2RouteXRoute) ([]byte, error) {
	file, err := excelize.OpenReader(bytes.NewReader(workbook))
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	rows, err := file.GetRows(mode)
	if err != nil || len(rows) == 0 {
		return nil, fmt.Errorf("missing %s matrix", mode)
	}
	values := map[string]float64{}
	for _, route := range routes {
		if route.Mode == mode && route.DistanceKm != nil {
			values[routeKey(mode, route.FromNodeID, route.ToNodeID)] = *route.DistanceKm
		}
	}
	for i, row := range rows[1:] {
		if len(row) == 0 {
			continue
		}
		for col, to := range rows[0][1:] {
			cell, err := excelize.CoordinatesToCellName(col+2, i+2)
			if err != nil {
				return nil, err
			}
			if err := file.SetCellValue(mode, cell, values[routeKey(mode, row[0], to)]); err != nil {
				return nil, err
			}
		}
	}
	buf, err := file.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
