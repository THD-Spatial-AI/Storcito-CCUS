// Package survey loads RUB data.
package survey

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// RUB's thresholds.
const (
	MinRespondents      = 30 // D5.3 ethics rule.
	contestedOppose     = 20.0
	contestedPetition   = 15.0
	lowKnowledgeShare   = 60.0
	undecidedShare      = 25.0
	climateConcernShare = 70.0 // RUB's sheets use 70.
)

// Applications and columns.
var applications = []struct{ Key, Column string }{
	{"general", "gen"},
	{"biomass", "biomass"},
	{"waste_to_energy", "wte"},
	{"utilisation", "util"},
	{"pipelines", "pipe"},
	{"storage", "stor"},
}

var factors = []string{
	"risks_transport_storage", "economy_jobs", "emission_reduction", "energy_use",
	"costs", "fossil_fuels", "trust_institutions",
}

var channels = []string{
	"newspaper", "library_books", "search_engine", "generative_ai",
	"news_channels", "local_politicians", "friends_family",
}

// Application support shares.
type Application struct {
	MeanSupport       float64  `json:"mean_support"`
	Support           float64  `json:"pct_support"`
	Oppose            float64  `json:"pct_oppose"`
	PetitionFor       *float64 `json:"pct_petition_for,omitempty"`
	PetitionAgainst   *float64 `json:"pct_petition_against,omitempty"`
	PetitionUndecided *float64 `json:"pct_petition_undecided,omitempty"`
	Contested         bool     `json:"contested"`
}

// Channel use and trust.
type Channel struct {
	Uses   float64 `json:"pct_uses"`
	Trusts float64 `json:"pct_trusts"`
}

// Suggestion is a message code.
type Suggestion struct {
	Code         string   `json:"code"`
	Applications []string `json:"applications,omitempty"`
}

// Region is one survey region.
type Region struct {
	Key            string                 `json:"key"`
	Country        string                 `json:"country"`
	Name           string                 `json:"name"`
	National       bool                   `json:"national"`
	Respondents    int                    `json:"respondents"`
	NUTS           []string               `json:"nuts"`
	States         []string               `json:"states"`
	SupportIndex   float64                `json:"support_index"`
	SupportLevel   string                 `json:"support_level"`
	DiffToNational *float64               `json:"diff_to_national,omitempty"`
	Comparison     string                 `json:"comparison,omitempty"`
	Applications   map[string]Application `json:"applications"`
	Factors        map[string]float64     `json:"factors"`
	Channels       map[string]Channel     `json:"channels"`
	TopFactors     []string               `json:"top_factors"`
	TopChannels    []string               `json:"top_channels"`
	ClimateConcern float64                `json:"pct_climate_concern"`
	LowKnowledge   float64                `json:"pct_low_knowledge"`
	Undecided      float64                `json:"pct_undecided"`
	Suggestions    []Suggestion           `json:"suggestions"`
}

// Load reads country sheets.
func Load(dir string) ([]Region, []string, error) {
	var regions []Region
	var warnings []string
	for _, country := range Countries {
		path := filepath.Join(dir, "app_data_"+country+".xlsx")
		if _, err := os.Stat(path); err != nil {
			warnings = append(warnings, "missing "+filepath.Base(path))
			continue
		}
		rows, err := readSheet(path)
		if err != nil {
			return nil, warnings, fmt.Errorf("%s: %w", filepath.Base(path), err)
		}
		parsed, warns := parseRows(country, rows)
		regions = append(regions, parsed...)
		warnings = append(warnings, warns...)
	}
	return regions, warnings, nil
}

func readSheet(path string) ([]map[string]string, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	raw, err := f.GetRows("app_data")
	if err != nil {
		return nil, err
	}
	if len(raw) < 2 {
		return nil, fmt.Errorf("app_data has no rows")
	}
	header := raw[0]
	rows := make([]map[string]string, 0, len(raw)-1)
	for _, cells := range raw[1:] {
		row := make(map[string]string, len(header))
		for i, name := range header {
			if i < len(cells) {
				row[strings.TrimSpace(name)] = strings.TrimSpace(cells[i])
			}
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func parseRows(country string, rows []map[string]string) ([]Region, []string) {
	var regions []Region
	var warnings []string
	areas := regionAreas[country]
	for _, row := range rows {
		name := row["region"]
		if name == "" || !strings.EqualFold(row["country"], country) {
			continue
		}
		n, _ := strconv.Atoi(row["n"])
		if n < MinRespondents || strings.EqualFold(row["small_sample"], "true") || row["small_sample"] == "1" {
			warnings = append(warnings, fmt.Sprintf("%s %s: too few respondents (%d)", country, name, n))
			continue
		}
		region := parseRegion(country, name, n, row)
		if !region.National {
			area, ok := areas[name]
			if !ok {
				warnings = append(warnings, fmt.Sprintf("%s %s: no area mapping", country, name))
				continue
			}
			region.NUTS, region.States = area.NUTS, area.States
		}
		regions = append(regions, region)
	}
	return regions, warnings
}

func parseRegion(country, name string, n int, row map[string]string) Region {
	num := func(key string) float64 {
		v, _ := strconv.ParseFloat(row[key], 64)
		return v
	}
	ptr := func(key string) *float64 {
		if _, ok := row[key]; !ok || row[key] == "" {
			return nil
		}
		v := num(key)
		return &v
	}
	region := Region{
		Key:            country + ":" + name,
		Country:        country,
		Name:           name,
		National:       name == nationalName,
		Respondents:    n,
		NUTS:           []string{},
		States:         []string{},
		SupportIndex:   num("mean_support_index"),
		Applications:   map[string]Application{},
		Factors:        map[string]float64{},
		Channels:       map[string]Channel{},
		ClimateConcern: num("pct_climate_concern"),
		LowKnowledge:   num("pct_low_knowledge"),
	}
	if region.National {
		region.Key = country + ":national"
	}
	region.SupportLevel = supportLevel(region.SupportIndex)
	if !region.National {
		region.DiffToNational = ptr("diff_to_national")
		region.Comparison = comparison(row["comparison"])
	}

	var undecided []float64
	for _, app := range applications {
		a := Application{
			MeanSupport: num("mean_support_" + app.Column),
			Support:     num("pct_support_" + app.Column),
			Oppose:      num("pct_oppose_" + app.Column),
		}
		if app.Key != "general" {
			a.PetitionFor = ptr("pct_petition_for_" + app.Column)
			a.PetitionAgainst = ptr("pct_petition_against_" + app.Column)
			a.PetitionUndecided = ptr("pct_petition_undecided_" + app.Column)
			if a.PetitionUndecided != nil {
				undecided = append(undecided, *a.PetitionUndecided)
			}
		}
		a.Contested = a.Oppose >= contestedOppose || (a.PetitionAgainst != nil && *a.PetitionAgainst >= contestedPetition)
		region.Applications[app.Key] = a
	}
	for _, v := range undecided {
		region.Undecided += v / float64(len(undecided))
	}
	for _, f := range factors {
		region.Factors[f] = num("pct_factor_" + f)
	}
	for _, ch := range channels {
		region.Channels[ch] = Channel{Uses: num("pct_uses_" + ch), Trusts: num("pct_trusts_" + ch)}
	}
	region.TopFactors = topKeys(factors, func(k string) float64 { return region.Factors[k] }, 3)
	region.TopChannels = topKeys(channels, func(k string) float64 { return region.Channels[k].Trusts }, 2)
	region.Suggestions = suggestions(region)
	return region
}

// supportLevel bands index.
func supportLevel(index float64) string {
	switch {
	case index < 4.5:
		return "divided"
	case index > 5.5:
		return "broad"
	default:
		return "moderate"
	}
}

func comparison(text string) string {
	switch {
	case strings.HasPrefix(text, "Above"):
		return "above"
	case strings.HasPrefix(text, "Below"):
		return "below"
	case strings.HasPrefix(text, "Around"):
		return "around"
	}
	return ""
}

// topKeys: highest first.
func topKeys(keys []string, value func(string) float64, n int) []string {
	sorted := append([]string(nil), keys...)
	sort.SliceStable(sorted, func(i, j int) bool { return value(sorted[i]) > value(sorted[j]) })
	return sorted[:n]
}

// suggestions: RUB's rules.
func suggestions(r Region) []Suggestion {
	out := make([]Suggestion, 0, 7)
	for _, f := range r.TopFactors {
		out = append(out, Suggestion{Code: "factor_" + f})
	}
	var contested []string
	for _, app := range applications {
		if r.Applications[app.Key].Contested {
			contested = append(contested, app.Key)
		}
	}
	if len(contested) > 0 {
		out = append(out, Suggestion{Code: "contested", Applications: contested})
	}
	if r.LowKnowledge >= lowKnowledgeShare {
		out = append(out, Suggestion{Code: "low_knowledge"})
	}
	if r.Undecided >= undecidedShare {
		out = append(out, Suggestion{Code: "undecided"})
	}
	if r.ClimateConcern >= climateConcernShare {
		out = append(out, Suggestion{Code: "climate_concern"})
	}
	return out
}
