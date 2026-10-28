package survey

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// RUB sentence openings.
var sentenceCodes = map[string]string{
	"Address safety concerns":         "factor_risks_transport_storage",
	"Focus on the climate benefit":    "factor_emission_reduction",
	"Explain cost trajectories":       "factor_costs",
	"Be transparent about the energy": "factor_energy_use",
	"Make responsibilities clear":     "factor_trust_institutions",
	"Address local economic effects":  "factor_economy_jobs",
	"Contested here":                  "contested",
	"Most residents know little":      "low_knowledge",
	"Many residents are undecided":    "undecided",
	"Climate concern is widespread":   "climate_concern",
}

var appNames = map[string]string{
	"CCUS in general":           "general",
	"Biomass with CCUS":         "biomass",
	"Waste-to-energy with CCUS": "waste_to_energy",
	"CO2 utilisation":           "utilisation",
	"CO2 pipelines":             "pipelines",
	"CO2 storage":               "storage",
}

// Matches RUB's texts.
func TestSuggestionsMatchSheets(t *testing.T) {
	dir := os.Getenv("SURVEY_DATA_DIR")
	if dir == "" {
		t.Skip("SURVEY_DATA_DIR not set")
	}
	checked := 0
	for _, country := range Countries {
		rows, err := readSheet(filepath.Join(dir, "app_data_"+country+".xlsx"))
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row["region"] == "" {
				continue
			}
			want := expectedSuggestions(t, row["recommendations"])
			got := parseRegion(country, row["region"], MinRespondents, row).Suggestions
			if !reflect.DeepEqual(got, want) {
				t.Errorf("%s %s:\n got %+v\nwant %+v", country, row["region"], got, want)
			}
			checked++
		}
	}
	if checked == 0 {
		t.Fatal("no rows checked")
	}
}

func expectedSuggestions(t *testing.T, text string) []Suggestion {
	t.Helper()
	var out []Suggestion
	for sentence := range strings.SplitSeq(text, " | ") {
		code := ""
		for prefix, c := range sentenceCodes {
			if strings.HasPrefix(sentence, prefix) {
				code = c
			}
		}
		if code == "" {
			t.Fatalf("unknown sentence %q", sentence)
		}
		s := Suggestion{Code: code}
		if code == "contested" {
			list := strings.TrimPrefix(strings.SplitN(sentence, ". ", 2)[0], "Contested here: ")
			for name := range strings.SplitSeq(list, ", ") {
				s.Applications = append(s.Applications, appNames[name])
			}
		}
		out = append(out, s)
	}
	return out
}

// Every sheet region mapped.
func TestLoadMapsAllRegions(t *testing.T) {
	dir := os.Getenv("SURVEY_DATA_DIR")
	if dir == "" {
		t.Skip("SURVEY_DATA_DIR not set")
	}
	regions, warnings, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) > 0 {
		t.Errorf("warnings: %v", warnings)
	}
	if len(regions) != 30 {
		t.Errorf("regions = %d, want 30", len(regions))
	}
}

func TestRules(t *testing.T) {
	row := map[string]string{
		"mean_support_index": "4.4", "pct_oppose_stor": "25", "pct_oppose_pipe": "10",
		"pct_petition_against_pipe": "15", "pct_low_knowledge": "59.9", "pct_climate_concern": "70",
		"pct_petition_undecided_biomass": "25", "pct_petition_undecided_wte": "25",
		"pct_petition_undecided_util": "25", "pct_petition_undecided_pipe": "25",
		"pct_petition_undecided_stor": "25", "pct_factor_costs": "50",
		"pct_factor_energy_use": "40", "pct_factor_fossil_fuels": "30", "pct_trusts_newspaper": "40",
	}
	r := parseRegion("DE", "Bayern", 100, row)
	if r.SupportLevel != "divided" {
		t.Errorf("level = %s", r.SupportLevel)
	}
	codes := []string{}
	for _, s := range r.Suggestions {
		codes = append(codes, s.Code)
	}
	want := []string{"factor_costs", "factor_energy_use", "factor_fossil_fuels", "contested", "undecided", "climate_concern"}
	if !reflect.DeepEqual(codes, want) {
		t.Errorf("codes = %v, want %v", codes, want)
	}
	if got := r.Suggestions[3].Applications; !reflect.DeepEqual(got, []string{"pipelines", "storage"}) {
		t.Errorf("contested = %v", got)
	}
}

func TestSmallSamplesDropped(t *testing.T) {
	rows := []map[string]string{
		{"country": "DE", "region": "Saarland", "n": "29"},
		{"country": "DE", "region": "Hessen", "n": "98", "small_sample": "TRUE"},
		{"country": "DE", "region": "Bayern", "n": "198"},
	}
	regions, warnings := parseRows("DE", rows)
	if len(regions) != 1 || regions[0].Name != "Bayern" || len(warnings) != 2 {
		t.Errorf("regions = %d, warnings = %v", len(regions), warnings)
	}
}
