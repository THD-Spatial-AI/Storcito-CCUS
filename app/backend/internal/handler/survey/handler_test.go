package survey

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"

	"spatialhub_backend/internal/survey"
)

func get(t *testing.T, h *Handler) map[string]any {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/survey/regions", h.Regions)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/survey/regions", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body["data"].(map[string]any)
}

// Empty without data.
func TestRegionsEmpty(t *testing.T) {
	data := get(t, NewHandler(nil))
	if regions := data["regions"].([]any); len(regions) != 0 {
		t.Errorf("regions = %d", len(regions))
	}
}

// Real sheets served.
func TestRegionsFromSheets(t *testing.T) {
	dir := os.Getenv("SURVEY_DATA_DIR")
	if dir == "" {
		t.Skip("SURVEY_DATA_DIR not set")
	}
	regions, _, err := survey.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	data := get(t, NewHandler(regions))
	list := data["regions"].([]any)
	if len(list) != 30 {
		t.Fatalf("regions = %d", len(list))
	}
	first := list[0].(map[string]any)
	for _, key := range []string{"key", "nuts", "applications", "suggestions", "top_factors", "support_level"} {
		if _, ok := first[key]; !ok {
			t.Errorf("missing %s", key)
		}
	}
	t.Logf("first region %v: level=%v nuts=%v suggestions=%d", first["name"], first["support_level"], first["nuts"], len(first["suggestions"].([]any)))
}
