package routing

import (
	"encoding/json"

	"github.com/xuri/excelize/v2"
	"platform.local/common/pkg/models"
)

var workbookColumns = []string{
	"mode", "from_node_id", "to_node_id", "distance_km", "transport_km", "average_resistance",
	"co2_t_per_yr", "eur_per_t", "eur_per_t_km", "annual_eur", "capex_eur",
	"outer_diameter_m", "boosters", "country",
}

// Routes as sheet.
func Workbook(routes []models.CO2RouteXRoute) ([]byte, error) {
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	const sheet = "routes"
	if err := file.SetSheetName("Sheet1", sheet); err != nil {
		return nil, err
	}
	header := make([]any, len(workbookColumns))
	for i, name := range workbookColumns {
		header[i] = name
	}
	if err := file.SetSheetRow(sheet, "A1", &header); err != nil {
		return nil, err
	}
	for i, route := range routes {
		meta := map[string]any{}
		_ = json.Unmarshal(route.Metadata, &meta)
		values := map[string]any{
			"mode": route.Mode, "from_node_id": route.FromNodeID, "to_node_id": route.ToNodeID,
			"distance_km": route.DistanceKm, "average_resistance": route.AverageResistance,
			"eur_per_t_km": route.CostEurPerTKm, "capex_eur": route.CapexEur,
		}
		row := make([]any, len(workbookColumns))
		for j, name := range workbookColumns {
			value, ok := values[name]
			if !ok {
				value = meta[name]
			}
			row[j] = cell(value)
		}
		cellName, _ := excelize.CoordinatesToCellName(1, i+2)
		if err := file.SetSheetRow(sheet, cellName, &row); err != nil {
			return nil, err
		}
	}
	buffer, err := file.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func cell(value any) any {
	if pointer, ok := value.(*float64); ok {
		if pointer == nil {
			return nil
		}
		return *pointer
	}
	return value
}
