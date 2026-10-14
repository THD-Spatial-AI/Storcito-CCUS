package meme

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"platform.local/common/pkg/models"
)

// Options tune the generated model. Zero values take the defaults.
type Options struct {
	Year       int     `json:"year"`
	Resolution string  `json:"resolution"`  // e.g. "12H"; must divide 24 hours.
	CaptureEUR float64 `json:"capture_eur"` // Credit per tonne of CO2 captured.
	StorageEUR float64 `json:"storage_eur"` // Cost per tonne of CO2 stored.
	Solver     string  `json:"solver"`
}

const (
	defaultYear       = 2025
	defaultResolution = "12H"
	defaultCaptureEUR = 30.0
	defaultStorageEUR = 20.0
	defaultSolver     = "glpk"
	carrier           = "CO2captured"
)

var unsafeID = regexp.MustCompile(`[^A-Za-z0-9_]+`)

func (o *Options) normalise() (stepHours int, err error) {
	if o.Year == 0 {
		o.Year = defaultYear
	}
	if o.Year < 1900 || o.Year > 2200 {
		return 0, fmt.Errorf("year %d is out of range", o.Year)
	}
	if o.Resolution == "" {
		o.Resolution = defaultResolution
	}
	if o.CaptureEUR == 0 {
		o.CaptureEUR = defaultCaptureEUR
	}
	if o.StorageEUR == 0 {
		o.StorageEUR = defaultStorageEUR
	}
	if o.Solver == "" {
		o.Solver = defaultSolver
	}
	if o.CaptureEUR < 0 || o.StorageEUR < 0 {
		return 0, fmt.Errorf("capture and storage prices cannot be negative")
	}
	res := strings.ToUpper(o.Resolution)
	if !strings.HasSuffix(res, "H") {
		return 0, fmt.Errorf("resolution %q must look like 1H, 6H or 12H", o.Resolution)
	}
	hours, convErr := strconv.Atoi(strings.TrimSuffix(res, "H"))
	if convErr != nil || hours < 1 || 24%hours != 0 {
		return 0, fmt.Errorf("resolution %q must be a whole number of hours that divides 24", o.Resolution)
	}
	o.Resolution = res
	return hours, nil
}

// BuildCopperplate turns emitter and storage nodes into a single-market
// ("copperplate") model: emitters feed CO2 in, sinks take it out, and
// transport is not modelled. Nodes of other types and nodes without a flux
// are skipped and reported as warnings.
func BuildCopperplate(name string, nodes []models.CO2Node, opts Options) (Payload, []string, error) {
	stepHours, err := opts.normalise()
	if err != nil {
		return Payload{}, nil, err
	}
	start := time.Date(opts.Year, time.January, 1, 0, 0, 0, 0, time.UTC)
	steps := int(start.AddDate(1, 0, 0).Sub(start).Hours()) / stepHours
	end := start.Add(time.Duration((steps-1)*stepHours) * time.Hour)

	var warnings []string
	meshNodes := map[string]any{}
	trade := map[string]any{}
	emitters, sinks := 0, 0
	for _, n := range nodes {
		var role string
		switch {
		case n.IsEmitter():
			role = "src"
		case n.IsSink():
			role = "sink"
		default:
			warnings = append(warnings, fmt.Sprintf("node %s (%s) skipped: not an emitter or sink", n.NodeID, n.NodeType))
			continue
		}
		if n.AnnualFlux == nil || *n.AnnualFlux <= 0 {
			warnings = append(warnings, fmt.Sprintf("node %s skipped: no annual flux", n.NodeID))
			continue
		}
		id := role + "_" + strings.Trim(unsafeID.ReplaceAllString(n.NodeID, "_"), "_")
		if _, dup := meshNodes[id]; dup {
			return Payload{}, nil, fmt.Errorf("node id %q collides with another node after sanitising", n.NodeID)
		}
		meshNodes[id] = map[string]any{"coords": map[string]any{"lat": n.Latitude, "lon": n.Longitude}}
		perStep := *n.AnnualFlux / float64(steps)
		if role == "src" {
			emitters++
			trade["capture_"+id] = map[string]any{
				"node": id, "carrier": carrier,
				"import": map[string]any{"limit": perStep, "price": -opts.CaptureEUR},
			}
		} else {
			sinks++
			trade["store_"+id] = map[string]any{
				"node": id, "carrier": carrier,
				"export": map[string]any{"limit": perStep, "price": -opts.StorageEUR},
			}
		}
	}
	if emitters == 0 || sinks == 0 {
		return Payload{}, warnings, fmt.Errorf("need at least one emitter and one storage or utilisation node with an annual flux (got %d emitters, %d sinks)", emitters, sinks)
	}

	const layout = "2006-01-02T15:04"
	return Payload{
		Model: map[string]any{
			"metadata":     map[string]any{"name": sanitiseName(name), "currency": "EUR", "currency_year": opts.Year},
			"time":         map[string]any{"start": start.Format(layout), "end": end.Format(layout), "resolution": opts.Resolution},
			"carriers":     map[string]any{carrier: map[string]any{"unit": "t"}},
			"nodes":        meshNodes,
			"technologies": map[string]any{},
			"trade":        trade,
		},
		Experiment: map[string]any{
			"mode": "plan", "objective": "min_cost", "copperplate": true,
			"solver": map[string]any{"name": opts.Solver},
		},
	}, warnings, nil
}

func sanitiseName(name string) string {
	name = strings.Trim(unsafeID.ReplaceAllString(name, "_"), "_")
	if name == "" {
		return "ccus_model"
	}
	return name
}
