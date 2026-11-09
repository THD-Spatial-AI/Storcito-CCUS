package routing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"platform.local/common/pkg/models"

	"spatialhub_backend/internal/storeco2"
)

func node(id, country string) models.CO2Node {
	return models.CO2Node{NodeID: id, CountryCode: &country}
}

// Fake STORE_CO2 server.
func fakeStore(t *testing.T, modes map[string][]string) (*httptest.Server, *[]map[string]any) {
	t.Helper()
	var mu sync.Mutex
	polls := map[string]int{}
	var started []map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.URL.Path == "/routing/modes":
			_ = json.NewEncoder(w).Encode(map[string]any{"countries": modes})
		case r.Method == http.MethodPost && r.URL.Path == "/routing/runs":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			started = append(started, body)
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]any{"job_id": "job-" + body["mode"].(string), "mode": body["mode"], "status": "running"})
		case strings.HasPrefix(r.URL.Path, "/routing/runs/"):
			id := strings.TrimPrefix(r.URL.Path, "/routing/runs/")
			polls[id]++
			if polls[id] < 2 {
				_ = json.NewEncoder(w).Encode(map[string]any{"job_id": id, "status": "running"})
				return
			}
			_, _ = w.Write([]byte(`{"job_id":"` + id + `","status":"completed","optimize":false,"routes":[
				{"mode":"pipeline","country":"NL","from_node_id":"e1","to_node_id":"sink:s1","status":"assigned",
				 "co2_t_per_yr":800000,"distance_km":12.5,"transport_km":12.5,"average_resistance":1.2,
				 "geometry":{"type":"LineString","coordinates":[[4.5,52.4],[4.6,52.5]]},
				 "costs":{"capex_eur":1.5e7,"eur_per_t":3.2,"eur_per_t_km":0.256,"annual_eur":2.56e6,"outer_diameter_m":0.3,"boosters":0}},
				{"mode":"pipeline","country":"NL","from_node_id":"e2","to_node_id":null,"status":"unreachable"}
			],"skipped":[],"unrouted_emitters":[]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server, &started
}

func TestExecuteMapsAssignedRoutes(t *testing.T) {
	server, started := fakeStore(t, map[string][]string{"NL": {"pipeline"}})
	runner := NewRunner(storeco2.NewClient(server.URL))
	runner.poll = time.Millisecond

	var updates []StageResult
	result, err := runner.Execute(context.Background(),
		[]models.CO2Node{node("e1", "NL"), node("e2", "NL"), node("sink:s1", "NL")},
		Inputs{Modes: []string{"pipeline", "truck"}},
		func(update StageResult) error { updates = append(updates, update); return nil })
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(*started) != 1 || (*started)[0]["mode"] != "pipeline" {
		t.Fatalf("expected one pipeline job (truck unavailable), got %v", *started)
	}
	if len(result.Routes) != 1 {
		t.Fatalf("expected the unreachable emitter dropped, got %d routes", len(result.Routes))
	}
	route := result.Routes[0]
	if route.FromNodeID != "e1" || route.ToNodeID != "sink:s1" || route.Mode != "pipeline" {
		t.Fatalf("unexpected route %+v", route)
	}
	if route.DistanceKm == nil || *route.DistanceKm != 12.5 || route.CapexEur == nil || *route.CapexEur != 1.5e7 || route.CostEurPerTKm == nil {
		t.Fatalf("distance and costs not mapped: %+v", route)
	}
	var meta map[string]any
	if err := json.Unmarshal(route.Metadata, &meta); err != nil {
		t.Fatal(err)
	}
	if geometry, _ := meta["geometry"].(map[string]any); geometry["type"] != "LineString" {
		t.Fatalf("geometry missing from metadata: %v", meta)
	}
	if meta["capacity_t_per_h"] != 100.0 || meta["eur_per_t"] != 3.2 {
		t.Fatalf("pipeline metadata not mapped: %v", meta)
	}
	if len(updates) < 2 || updates[len(updates)-1].Job.Status != storeco2.RoutingCompleted || updates[0].Stage != models.StageRoutingPipeline {
		t.Fatalf("progress not reported: %+v", updates)
	}
	want := []string{"e2: no pipeline path to a selected sink", "truck routing is not available for the selected countries"}
	if strings.Join(result.Notes, "|") != strings.Join(want, "|") {
		t.Fatalf("notes = %q, want %q", result.Notes, want)
	}
}

func TestJobNotesExplainUnroutedEmitters(t *testing.T) {
	plant := node("e1", "DE")
	plant.Name = "Plant"
	nodes := map[string]models.CO2Node{"e1": plant, "e2": node("e2", "NL"), "e3": node("e3", "NL")}
	job := &storeco2.RoutingJob{
		Optimize: true,
		Skipped:  []string{"DE: no sink landed within 500 m of /data/railway/DE_railways.parquet", "e3: not an emitter in the capture table"},
		Routes:   []storeco2.RoutingRoute{{FromNodeID: "e4", Status: "not_assigned"}},
		// Only e2 counts.
		UnroutedEmitters: []string{"e1", "e2", "e3"},
	}
	want := []string{
		"railway routing in DE: no sink landed within 500 m",
		"e3: not in the STORE_CO2 capture table",
		"e4: left out by the sink-capacity assignment (railway)",
		"e2: no capturable CO₂ in STORE_CO2",
	}
	if got := jobNotes("railway", job, nodes); strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("notes = %q, want %q", got, want)
	}
}

func TestExecuteFailsWhenNoModeIsAvailable(t *testing.T) {
	server, started := fakeStore(t, map[string][]string{"NL": {"pipeline"}})
	runner := NewRunner(storeco2.NewClient(server.URL))
	_, err := runner.Execute(context.Background(), []models.CO2Node{node("e1", "NL"), node("sink:s1", "NL")},
		Inputs{Modes: []string{"railway"}}, nil)
	if err == nil || !strings.Contains(err.Error(), "railway routing is not available") {
		t.Fatalf("expected an unavailable-mode error, got %v", err)
	}
	if len(*started) != 0 {
		t.Fatalf("no job should start, got %v", *started)
	}
}

func TestInputsValidate(t *testing.T) {
	for _, in := range []Inputs{{}, {Modes: []string{"boat"}}, {Modes: []string{"pipeline", "pipeline"}}} {
		if in.Validate() == nil {
			t.Errorf("expected %+v to be invalid", in)
		}
	}
	if err := (Inputs{Modes: []string{"pipeline", "truck", "railway"}}).Validate(); err != nil {
		t.Errorf("valid modes rejected: %v", err)
	}
}

func TestWorkbook(t *testing.T) {
	distance := 10.0
	data, err := Workbook([]models.CO2RouteXRoute{{Mode: "pipeline", FromNodeID: "e1", ToNodeID: "sink:s1", DistanceKm: &distance, Metadata: []byte(`{"eur_per_t":3}`)}})
	if err != nil || len(data) == 0 {
		t.Fatalf("Workbook: %v", err)
	}
}

// Needs STORECO2_LIVE_* env.
func TestLiveStoreCO2(t *testing.T) {
	url, ids := os.Getenv("STORECO2_LIVE_URL"), os.Getenv("STORECO2_LIVE_NODES")
	if url == "" || ids == "" {
		t.Skip("set STORECO2_LIVE_URL and STORECO2_LIVE_NODES")
	}
	var nodes []models.CO2Node
	for id := range strings.SplitSeq(ids, ",") {
		nodes = append(nodes, node(id, "NL"))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	result, err := NewRunner(storeco2.NewClient(url)).Execute(ctx, nodes, Inputs{Modes: []string{"pipeline"}}, nil)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	for _, route := range result.Routes {
		t.Logf("%s → %s: %v km, capex %v, €/t·km %v, %s", route.FromNodeID, route.ToNodeID, value(route.DistanceKm), value(route.CapexEur), value(route.CostEurPerTKm), route.Metadata)
	}
	if len(result.Routes) == 0 {
		t.Fatal("no routes")
	}
}

func value(v *float64) any {
	if v == nil {
		return nil
	}
	return *v
}
