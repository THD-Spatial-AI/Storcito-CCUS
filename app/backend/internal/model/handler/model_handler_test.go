package model

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"

	commonmodels "platform.local/common/pkg/models"
	"spatialhub_backend/internal/testutil"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestNewModelHandler(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)
	assert.NotNil(t, handler)
	assert.NotNil(t, handler.store)
}

func TestNewModelHandlerWithCache(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)
	assert.NotNil(t, handler)
	assert.NotNil(t, handler.store)
}

func TestCreateModel_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/models", strings.NewReader(`{"title":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.CreateModel(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestGetModel_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/models/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	handler.GetModel(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestGetModels_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/models", nil)

	handler.GetModels(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestDeleteModel_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/models/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	handler.DeleteModel(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestShareModel_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/models/1/share", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	handler.ShareModel(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestGetModelStats_NoUserContext(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	handler := NewModelHandlerWithCache(db, nil, nil, "http://kc", "realm", nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/models/stats", nil)

	handler.GetModelStats(c)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestListOrderClause_LastActivityStrict(t *testing.T) {
	// no status bucket
	assert.Equal(t, "COALESCE(calculation_completed_at, updated_at) desc", listOrderClause("last_activity", "desc", false))
}

func TestListOrderClause_LastActivityFamilyNewest(t *testing.T) {
	clause := listOrderClause("last_activity", "desc", true)
	assert.NotContains(t, clause, "CASE WHEN")
	assert.True(t, strings.HasPrefix(clause, "(SELECT MAX(COALESCE(latest_versions.calculation_completed_at"))
	assert.Contains(t, clause, "latest_versions.parent_model_id = models.id")
	assert.True(t, strings.HasSuffix(clause, " desc"))
}

func TestApplyOwnerTerritoryFilters(t *testing.T) {
	db, _ := testutil.NewMockDB(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/models?owner=ana&territory=lugo", nil)
	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return applyOwnerTerritoryFilters(c, tx.Model(&commonmodels.Model{})).Find(&[]commonmodels.Model{})
	})
	assert.Contains(t, sql, "user_email ILIKE '%ana%'")
	assert.Contains(t, sql, "region ILIKE '%lugo%' OR country ILIKE '%lugo%'")
}

func TestAdminTabsCoverEveryStatus(t *testing.T) {
	// tabs sum up
	seen := map[string]int{}
	for _, tab := range []string{"drafts", "queue", "in_progress", "completed_only", "published", "failed"} {
		for _, s := range tabStatuses[tab] {
			seen[s]++
		}
	}
	for s := range listableStatuses {
		assert.Equal(t, 1, seen[s], s)
	}
}
