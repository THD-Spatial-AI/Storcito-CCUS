package co2sources

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"platform.local/common/pkg/httputil"

	"spatialhub_backend/internal/storeco2"
)

// STORE_CO2 catalogue proxy.
type Handler struct {
	store *storeco2.Client
}

// NewHandler builds it.
func NewHandler(store *storeco2.Client) *Handler {
	return &Handler{store: store}
}

// List pages point sources.
func (h *Handler) List(c *gin.Context) {
	if h.store == nil {
		httputil.InternalError(c, "STORE_CO2 client is not configured")
		return
	}

	query := storeco2.PointSourceQuery{
		Country:      strings.TrimSpace(c.Query("country")),
		CaptureGroup: strings.TrimSpace(c.Query("capture_group")),
		BBox:         strings.TrimSpace(c.Query("bbox")),
		Search:       strings.TrimSpace(c.Query("search")),
	}
	if raw := strings.TrimSpace(c.Query("min_co2_t")); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 {
			httputil.BadRequest(c, "Invalid min_co2_t")
			return
		}
		query.MinCO2T = value
	}
	if raw := strings.TrimSpace(c.Query("with_coordinates")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			httputil.BadRequest(c, "Invalid with_coordinates")
			return
		}
		query.WithCoordinates = &value
	}
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value <= 0 {
			httputil.BadRequest(c, "Invalid limit")
			return
		}
		query.Limit = value
	}
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 {
			httputil.BadRequest(c, "Invalid offset")
			return
		}
		query.Offset = value
	}

	page, err := h.store.PointSources(c.Request.Context(), query)
	if err != nil {
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	httputil.SuccessResponse(c, page)
}

// ByID fetches one source.
func (h *Handler) ByID(c *gin.Context) {
	if h.store == nil {
		httputil.InternalError(c, "STORE_CO2 client is not configured")
		return
	}

	entityID := strings.TrimSpace(c.Query("id"))
	if entityID == "" {
		httputil.BadRequest(c, "Missing id")
		return
	}

	source, status, err := h.store.PointSource(c.Request.Context(), entityID)
	if err != nil {
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	if status == http.StatusNotFound {
		httputil.NotFound(c, "Point source not found")
		return
	}
	httputil.SuccessResponse(c, source)
}

// Stats summarises the dataset.
func (h *Handler) Stats(c *gin.Context) {
	if h.store == nil {
		httputil.InternalError(c, "STORE_CO2 client is not configured")
		return
	}

	stats, err := h.store.Stats(c.Request.Context())
	if err != nil {
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	httputil.SuccessResponse(c, stats)
}

// NodeTypes lists the taxonomy.
func (h *Handler) NodeTypes(c *gin.Context) {
	if h.store == nil {
		httputil.InternalError(c, "STORE_CO2 client is not configured")
		return
	}

	types, err := h.store.NodeTypes(c.Request.Context())
	if err != nil {
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	httputil.SuccessResponse(c, gin.H{"node_types": types})
}
