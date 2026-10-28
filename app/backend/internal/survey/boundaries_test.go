package survey

import (
	"encoding/json"
	"os"
	"sort"
	"testing"
)

// Map file matches regions.
func TestBoundariesMatchRegions(t *testing.T) {
	raw, err := os.ReadFile("../../../frontend/public/data/nuts-survey.geojson")
	if err != nil {
		t.Skip("boundary file not found")
	}
	var file struct {
		Features []struct {
			Properties struct {
				Key *string `json:"key"`
			} `json:"properties"`
		} `json:"features"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, f := range file.Features {
		if f.Properties.Key != nil {
			got[*f.Properties.Key] = true
		}
	}
	var missing []string
	for country, areas := range regionAreas {
		for name := range areas {
			key := country + ":" + name
			if !got[key] {
				missing = append(missing, key)
			}
			delete(got, key)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 || len(got) > 0 {
		t.Errorf("rebuild scripts/build_survey_boundaries.py: missing %v, unknown %v", missing, got)
	}
}
