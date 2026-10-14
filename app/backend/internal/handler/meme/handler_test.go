package meme

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	client "spatialhub_backend/internal/meme"
	"spatialhub_backend/internal/testutil"
)

func fakeMEME(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/validate":
			_, _ = w.Write([]byte(`{"valid":true,"warnings":null}`))
		case "/simulate":
			_, _ = w.Write([]byte(`{"id":"job1","state":"queued","warnings":["w"]}`))
		case "/jobs/job1/status":
			_, _ = w.Write([]byte(`{"id":"job1","state":"succeeded","runs":[{"exit_code":0,"contract":{"success":true,"termination_condition":"optimal","objective":-5}}]}`))
		case "/jobs/job1":
			_, _ = w.Write([]byte("PKzip"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func serve(h *Handler, user, method, path, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if user != "" {
			c.Set("user_id", user)
		}
	})
	r.POST("/models/:id/meme/run", h.Run)
	r.GET("/meme/jobs/:jobID", h.Status)
	r.GET("/meme/jobs/:jobID/result", h.Result)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	r.ServeHTTP(w, req)
	return w
}

func TestRunThenStatusAndOwnership(t *testing.T) {
	db, mock := testutil.NewMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "model_co2_nodes"`).WillReturnRows(
		sqlmock.NewRows([]string{"id", "model_id", "co2_node_id"}).AddRow(1, 7, 10).AddRow(2, 7, 11))
	mock.ExpectQuery(`SELECT .* FROM "co2_nodes"`).WillReturnRows(
		sqlmock.NewRows([]string{"id", "node_id", "node_type", "annual_flux", "latitude", "longitude"}).
			AddRow(10, "cem", "cement", 730.0, 53.0, 9.0).
			AddRow(11, "sto", "storage", 1460.0, 53.5, 8.0))

	srv := fakeMEME(t)
	h := NewHandler(db, client.NewClient(srv.URL, ""))

	w := serve(h, "alice", http.MethodPost, "/models/7/meme/run", "")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"job_id":"job1"`) {
		t.Fatalf("run: %d %s", w.Code, w.Body.String())
	}

	w = serve(h, "alice", http.MethodGet, "/meme/jobs/job1", "")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"objective":-5`) || !strings.Contains(w.Body.String(), `"model_id":7`) {
		t.Fatalf("status: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "stdout") {
		t.Errorf("status must not leak solver logs")
	}

	w = serve(h, "alice", http.MethodGet, "/meme/jobs/job1/result", "")
	if w.Code != http.StatusOK || w.Header().Get("Content-Type") != "application/zip" || w.Body.String() != "PKzip" {
		t.Fatalf("result: %d %q", w.Code, w.Body.String())
	}

	for _, path := range []string{"/meme/jobs/job1", "/meme/jobs/job1/result"} {
		if w = serve(h, "mallory", http.MethodGet, path, ""); w.Code != http.StatusNotFound {
			t.Errorf("%s as another user: want 404, got %d", path, w.Code)
		}
		if w = serve(h, "", http.MethodGet, path, ""); w.Code != http.StatusUnauthorized {
			t.Errorf("%s anonymous: want 401, got %d", path, w.Code)
		}
	}
	if w = serve(h, "alice", http.MethodGet, "/meme/jobs/unknown", ""); w.Code != http.StatusNotFound {
		t.Errorf("unknown job: want 404, got %d", w.Code)
	}
}

func TestRunWithoutNodes(t *testing.T) {
	db, mock := testutil.NewMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "model_co2_nodes"`).WillReturnRows(sqlmock.NewRows([]string{"id"}))
	h := NewHandler(db, client.NewClient(fakeMEME(t).URL, ""))
	if w := serve(h, "alice", http.MethodPost, "/models/7/meme/run", ""); w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d %s", w.Code, w.Body.String())
	}
}

func TestMEMEDown(t *testing.T) {
	db, mock := testutil.NewMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "model_co2_nodes"`).WillReturnRows(
		sqlmock.NewRows([]string{"id", "model_id", "co2_node_id"}).AddRow(1, 7, 10).AddRow(2, 7, 11))
	mock.ExpectQuery(`SELECT .* FROM "co2_nodes"`).WillReturnRows(
		sqlmock.NewRows([]string{"id", "node_id", "node_type", "annual_flux"}).
			AddRow(10, "cem", "cement", 730.0).AddRow(11, "sto", "storage", 1460.0))
	srv := fakeMEME(t)
	url := srv.URL
	srv.Close()
	h := NewHandler(db, client.NewClient(url, ""))
	if w := serve(h, "alice", http.MethodPost, "/models/7/meme/run", ""); w.Code != http.StatusBadGateway {
		t.Fatalf("want 502, got %d %s", w.Code, w.Body.String())
	}
}
