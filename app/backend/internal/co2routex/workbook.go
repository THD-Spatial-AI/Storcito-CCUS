package co2routex

import (
	"bytes"
	"fmt"
	"math"
	"strings"

	"github.com/xuri/excelize/v2"
	"platform.local/common/pkg/models"
)

const nodesSheet = "nodes"

// Adjacency sheets.
var modeSheets = []string{"pipeline", "truck", "railway"}

// Nodes worksheet columns.
var nodeColumns = []string{
	"node_id", "node_name", "longitude", "latitude",
	"altitude", "annual_flux", "node_type", "country_code",
}

// BuildWorkbook writes node_metrics.xlsx.
func BuildWorkbook(nodes []models.CO2Node) ([]byte, error) {
	if len(nodes) == 0 {
		return nil, fmt.Errorf("no nodes to write")
	}
	seen := map[string]bool{}
	for _, node := range nodes {
		if strings.TrimSpace(node.NodeID) == "" || seen[node.NodeID] {
			return nil, fmt.Errorf("node IDs must be nonempty and unique across sources")
		}
		seen[node.NodeID] = true
		if math.IsNaN(node.Longitude) || math.IsInf(node.Longitude, 0) || math.IsNaN(node.Latitude) || math.IsInf(node.Latitude, 0) || node.Longitude < -180 || node.Longitude > 180 || node.Latitude < -90 || node.Latitude > 90 {
			return nil, fmt.Errorf("invalid coordinates for %s", node.NodeID)
		}
	}

	file := excelize.NewFile()
	defer func() { _ = file.Close() }()

	// Rename default sheet.
	if err := file.SetSheetName("Sheet1", nodesSheet); err != nil {
		return nil, err
	}

	header := make([]any, len(nodeColumns))
	for i, name := range nodeColumns {
		header[i] = name
	}
	if err := file.SetSheetRow(nodesSheet, "A1", &header); err != nil {
		return nil, err
	}

	ids := make([]any, 0, len(nodes))
	for i, node := range nodes {
		row := []any{
			node.NodeID, node.Name, node.Longitude, node.Latitude,
			derefFloat(node.Altitude), derefFloat(node.AnnualFlux),
			node.NodeType, derefString(node.CountryCode),
		}
		cell := fmt.Sprintf("A%d", i+2)
		if err := file.SetSheetRow(nodesSheet, cell, &row); err != nil {
			return nil, err
		}
		ids = append(ids, node.NodeID)
	}

	// Square matrices, zero-filled.
	for _, mode := range modeSheets {
		if _, err := file.NewSheet(mode); err != nil {
			return nil, err
		}
		corner := append([]any{nil}, ids...)
		if err := file.SetSheetRow(mode, "A1", &corner); err != nil {
			return nil, err
		}
		for i, id := range ids {
			row := make([]any, 0, len(ids)+1)
			row = append(row, id)
			for range ids {
				row = append(row, 0)
			}
			cell := fmt.Sprintf("A%d", i+2)
			if err := file.SetSheetRow(mode, cell, &row); err != nil {
				return nil, err
			}
		}
	}

	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func derefFloat(v *float64) any {
	if v == nil {
		return nil
	}
	return *v
}

func derefString(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

// Accepted types.
var (
	emitterTypes = []string{
		"bioenergy", "biogas", "cement", "chemicals", "coal_power",
		"emitter", "fossil_power", "gas_power", "gas_processing",
		"glass", "industry", "iron_and_steel", "pulp_and_paper",
		"refinery", "waste_to_energy",
	}
	storageTypes = []string{"storage", "utilisation"}
)

// ConnectionOptions is the taxonomy.
func ConnectionOptions() map[string]any {
	return map[string]any{
		"mode_sheets":   modeSheets,
		"emitter_types": emitterTypes,
		"storage_types": storageTypes,
	}
}
