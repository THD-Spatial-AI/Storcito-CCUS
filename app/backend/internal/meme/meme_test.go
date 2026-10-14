package meme

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"platform.local/common/pkg/models"
)

func flux(v float64) *float64 { return &v }

func sampleNodes() []models.CO2Node {
	return []models.CO2Node{
		{NodeID: "steel-1", NodeType: "iron_and_steel", Latitude: 52.1, Longitude: 10.4, AnnualFlux: flux(7300)},
		{NodeID: "cement 2", NodeType: models.NodeTypeCement, Latitude: 53.9, Longitude: 9.6, AnnualFlux: flux(3650)},
		{NodeID: "store-a", NodeType: models.NodeTypeStorage, Latitude: 53.5, Longitude: 8.1, AnnualFlux: flux(14600)},
		{NodeID: "hub", NodeType: models.NodeTypeTransport, Latitude: 53.0, Longitude: 8.8},
		{NodeID: "empty", NodeType: models.NodeTypeCement, Latitude: 50, Longitude: 8},
	}
}

func TestBuildCopperplate(t *testing.T) {
	p, warnings, err := BuildCopperplate("my model!", sampleNodes(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 2 {
		t.Fatalf("want 2 warnings (transport, no flux), got %v", warnings)
	}
	nodes := p.Model["nodes"].(map[string]any)
	for _, id := range []string{"src_steel_1", "src_cement_2", "sink_store_a"} {
		if _, ok := nodes[id]; !ok {
			t.Errorf("missing node %s in %v", id, nodes)
		}
	}
	if len(nodes) != 3 {
		t.Errorf("want 3 nodes, got %d", len(nodes))
	}
	trade := p.Model["trade"].(map[string]any)
	imp := trade["capture_src_steel_1"].(map[string]any)["import"].(map[string]any)
	// 7300 t/yr over 730 twelve-hour steps.
	if imp["limit"].(float64) != 10 || imp["price"].(float64) != -30 {
		t.Errorf("unexpected import %v", imp)
	}
	exp := trade["store_sink_store_a"].(map[string]any)["export"].(map[string]any)
	if exp["limit"].(float64) != 20 || exp["price"].(float64) != -20 {
		t.Errorf("unexpected export %v", exp)
	}
	tm := p.Model["time"].(map[string]any)
	if tm["start"] != "2025-01-01T00:00" || tm["end"] != "2025-12-31T12:00" || tm["resolution"] != "12H" {
		t.Errorf("unexpected time %v", tm)
	}
	if p.Model["metadata"].(map[string]any)["name"] != "my_model" {
		t.Errorf("name not sanitised: %v", p.Model["metadata"])
	}
	if p.Experiment["copperplate"] != true {
		t.Errorf("experiment must be copperplate: %v", p.Experiment)
	}
}

func TestBuildCopperplateRejects(t *testing.T) {
	onlyEmitter := sampleNodes()[:2]
	cases := map[string]struct {
		nodes []models.CO2Node
		opts  Options
	}{
		"no sink":        {onlyEmitter, Options{}},
		"bad resolution": {sampleNodes(), Options{Resolution: "5H"}},
		"not hours":      {sampleNodes(), Options{Resolution: "day"}},
		"bad year":       {sampleNodes(), Options{Year: 12}},
		"negative price": {sampleNodes(), Options{CaptureEUR: -1}},
		"id collision": {[]models.CO2Node{
			{NodeID: "a-b", NodeType: models.NodeTypeCement, AnnualFlux: flux(1)},
			{NodeID: "a b", NodeType: models.NodeTypeCement, AnnualFlux: flux(1)},
			{NodeID: "s", NodeType: models.NodeTypeStorage, AnnualFlux: flux(1)},
		}, Options{}},
	}
	for name, tc := range cases {
		if _, _, err := BuildCopperplate("m", tc.nodes, tc.opts); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestClientFlow(t *testing.T) {
	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/validate":
			var body Payload
			_ = json.NewDecoder(r.Body).Decode(&body)
			gotKey = body.APIKey
			if r.URL.Query().Get("target") != Target {
				t.Errorf("target missing")
			}
			if body.Model["bad"] != nil {
				w.WriteHeader(http.StatusUnprocessableEntity)
				_, _ = w.Write([]byte(`{"valid":false,"error":"nope"}`))
				return
			}
			_, _ = w.Write([]byte(`{"valid":true,"warnings":null}`))
		case r.URL.Path == "/simulate":
			_, _ = w.Write([]byte(`{"id":"abc","state":"queued","warnings":null}`))
		case r.URL.Path == "/jobs/abc/status":
			_, _ = w.Write([]byte(`{"id":"abc","state":"succeeded","runs":[{"index":0,"exit_code":0,"contract":{"success":true,"termination_condition":"optimal","objective":-12.5}}]}`))
		case r.URL.Path == "/jobs/abc":
			w.Header().Set("Content-Type", "application/zip")
			_, _ = w.Write([]byte("PK"))
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"no such job"}`))
		}
	}))
	defer srv.Close()

	c := NewClient(srv.URL+"/", "secret")
	ctx := context.Background()

	v, err := c.Validate(ctx, Payload{Model: map[string]any{}})
	if err != nil || !v.Valid {
		t.Fatalf("validate: %v %+v", err, v)
	}
	if gotKey != "secret" {
		t.Errorf("api key not sent, got %q", gotKey)
	}
	v, err = c.Validate(ctx, Payload{Model: map[string]any{"bad": 1}})
	if err != nil || v.Valid || v.Error != "nope" {
		t.Fatalf("a 422 must be a verdict, got %v %+v", err, v)
	}
	sub, err := c.Simulate(ctx, Payload{})
	if err != nil || sub.ID != "abc" {
		t.Fatalf("simulate: %v %+v", err, sub)
	}
	job, err := c.Status(ctx, "abc")
	if err != nil || !job.IsFinished() || job.Runs[0].Contract.Objective != -12.5 {
		t.Fatalf("status: %v %+v", err, job)
	}
	body, err := c.Result(ctx, "abc")
	if err != nil {
		t.Fatal(err)
	}
	_ = body.Close()
	if _, err = c.Status(ctx, "missing"); err == nil || !strings.Contains(err.Error(), "no such job") {
		t.Errorf("expected API error, got %v", err)
	}
}

// Set MEME_LIVE_URL (and MEME_API_KEY if needed) to run the builder output
// through a real MEME: validate, simulate, then wait for the result.
func TestLiveMEME(t *testing.T) {
	base := os.Getenv("MEME_LIVE_URL")
	if base == "" {
		t.Skip("MEME_LIVE_URL not set")
	}
	c := NewClient(base, os.Getenv("MEME_API_KEY"))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	p, _, err := BuildCopperplate("ccus_live_test", sampleNodes(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	v, err := c.Validate(ctx, p)
	if err != nil || !v.Valid {
		t.Fatalf("validate: %v %+v", err, v)
	}
	sub, err := c.Simulate(ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	for {
		job, err := c.Status(ctx, sub.ID)
		if err != nil {
			t.Fatal(err)
		}
		if job.IsFinished() {
			if job.State != StateSucceeded || len(job.Runs) == 0 || !job.Runs[0].Contract.Success {
				t.Fatalf("job did not succeed: %+v", job)
			}
			t.Logf("objective %v (%s)", job.Runs[0].Contract.Objective, job.Runs[0].Contract.TerminationCondition)
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("timed out waiting for job")
		case <-time.After(2 * time.Second):
		}
	}
}
