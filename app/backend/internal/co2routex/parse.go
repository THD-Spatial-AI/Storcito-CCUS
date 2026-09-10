package co2routex

import (
	"bytes"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// One matrix cell.
type RoutePair struct {
	Mode   string
	FromID string
	ToID   string
	// Candidate or distance.
	Value float64
}

// ParseMatrices reads matrices.
func ParseMatrices(workbook []byte) ([]RoutePair, error) {
	file, err := excelize.OpenReader(bytes.NewReader(workbook))
	if err != nil {
		return nil, fmt.Errorf("unreadable workbook: %w", err)
	}
	defer func() { _ = file.Close() }()

	var pairs []RoutePair
	for _, mode := range modeSheets {
		rows, err := file.GetRows(mode)
		if err != nil || len(rows) < 2 {
			continue
		}

		// Column ids.
		header := rows[0]
		for _, row := range rows[1:] {
			if len(row) == 0 {
				continue
			}
			fromID := strings.TrimSpace(row[0])
			if fromID == "" {
				continue
			}
			for col := 1; col < len(row) && col < len(header); col++ {
				toID := strings.TrimSpace(header[col])
				if toID == "" || toID == fromID {
					continue
				}
				value, err := strconv.ParseFloat(strings.TrimSpace(row[col]), 64)
				// Zero means unrouted.
				if err != nil || value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
					continue
				}
				pairs = append(pairs, RoutePair{
					Mode:   mode,
					FromID: fromID,
					ToID:   toID,
					Value:  value,
				})
			}
		}
	}
	return pairs, nil
}
