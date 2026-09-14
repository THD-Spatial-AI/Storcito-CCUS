package co2nodes

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"platform.local/common/pkg/httputil"
	"platform.local/common/pkg/models"

	"spatialhub_backend/internal/storeco2"
)

// Import source label.
const sourceStoreCO2 = "store_co2"

// cleanState drops NUTS junk.
func cleanState(state *string, countryCode *string) *string {
	if state == nil {
		return nil
	}
	value := strings.TrimSpace(*state)
	if value == "" || strings.Contains(value, ",") {
		return nil
	}
	// Country code, then digit.
	if countryCode != nil && strings.HasPrefix(value, strings.ToUpper(*countryCode)) {
		rest := value[len(*countryCode):]
		if rest != "" && rest[0] >= '0' && rest[0] <= '9' {
			return nil
		}
	}
	if value == "Norway" {
		return nil
	}
	return &value
}

// Serves node catalogue.
type Handler struct {
	db    *gorm.DB
	store *storeco2.Client
}

// NewHandler builds it.
func NewHandler(db *gorm.DB, store *storeco2.Client) *Handler {
	return &Handler{db: db, store: store}
}

// List catalogue nodes.
func (h *Handler) List(c *gin.Context) {
	query := h.db.Model(&models.CO2Node{})

	if country := strings.TrimSpace(c.Query("country")); country != "" {
		query = query.Where("UPPER(country_code) = UPPER(?)", country)
	}
	if nodeType := strings.TrimSpace(c.Query("node_type")); nodeType != "" {
		query = query.Where("node_type = ?", nodeType)
	}
	if industry := strings.TrimSpace(c.Query("industry")); industry != "" {
		query = query.Where("industry ILIKE ?", industry)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		query = query.Where("node_name ILIKE ? OR node_id ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var nodes []models.CO2Node
	if err := query.Omit("metadata").Order("node_id asc").Find(&nodes).Error; err != nil {
		httputil.InternalError(c, "Failed to load CO2 nodes")
		return
	}

	httputil.SuccessResponse(c, gin.H{"items": nodes, "total": len(nodes)})
}

type importRequest struct {
	Country string   `json:"country"`
	MinCO2T *float64 `json:"min_co2_t"`
	All     bool     `json:"all"`
	BBox    string   `json:"bbox"`
	Limit   int      `json:"limit"`
	Offset  int      `json:"offset"`
}

// Import pulls from STORE_CO2.
func (h *Handler) Import(c *gin.Context) {
	if h.store == nil {
		httputil.InternalError(c, "STORE_CO2 client is not configured")
		return
	}

	var req importRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.BadRequest(c, "Invalid request body")
		return
	}
	if req.Limit < 0 || req.Limit > 10000 || req.Offset < 0 || (req.MinCO2T != nil && (math.IsNaN(*req.MinCO2T) || math.IsInf(*req.MinCO2T, 0) || *req.MinCO2T < 0)) {
		httputil.BadRequest(c, "Invalid import bounds")
		return
	}
	if req.Limit == 0 {
		req.Limit = 1000
		req.All = true
	}
	minFlux := 0.0
	if req.MinCO2T != nil {
		minFlux = *req.MinCO2T
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	page, err := h.store.ImportNodes(ctx, storeco2.NodeQuery{
		Country:    req.Country,
		MinCO2T:    minFlux,
		HasMinCO2T: req.MinCO2T != nil,
		BBox:       req.BBox,
		Limit:      req.Limit,
		Offset:     req.Offset,
	}, req.All)
	if err != nil {
		var upstream *storeco2.HTTPError
		if errors.As(err, &upstream) && (upstream.StatusCode == 400 || upstream.StatusCode == 409 || upstream.StatusCode == 422) {
			c.JSON(upstream.StatusCode, gin.H{"error": upstream.Detail})
			return
		}
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	fetched := page.Nodes
	if len(fetched) == 0 {
		httputil.SuccessResponse(c, gin.H{"imported": 0, "total": h.count(), "source_total": page.Total, "has_more": page.HasMore, "next_offset": req.Offset, "dataset_version": page.DatasetVersion})
		return
	}

	rows := make([]models.CO2Node, 0, len(fetched))
	for _, node := range fetched {
		rows = append(rows, models.CO2Node{
			NodeID:       node.NodeID,
			Name:         node.NodeName,
			Longitude:    node.Longitude,
			Latitude:     node.Latitude,
			Altitude:     node.Altitude,
			AnnualFlux:   node.AnnualFlux,
			NodeType:     node.NodeType,
			Industry:     node.Industry,
			Metadata:     datatypes.JSON(node.Metadata),
			CountryCode:  node.CountryCode,
			State:        cleanState(node.State, node.CountryCode),
			Municipality: node.Municipality,
			Source:       sourceStoreCO2,
		})
	}

	// Re-runnable.
	err = h.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "source"}, {Name: "node_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"node_name", "longitude", "latitude", "altitude",
				"annual_flux", "node_type", "industry", "country_code",
				"state", "municipality", "metadata", "updated_at",
			}),
		}).CreateInBatches(&rows, 200).Error
	})
	if err != nil {
		httputil.InternalError(c, "Failed to save imported nodes")
		return
	}

	httputil.SuccessResponse(c, gin.H{"imported": len(rows), "total": h.count(), "source_total": page.Total, "has_more": page.HasMore, "next_offset": req.Offset + len(rows), "dataset_version": page.DatasetVersion})
}

func (h *Handler) count() int64 {
	var total int64
	h.db.Model(&models.CO2Node{}).Count(&total)
	return total
}

// Source snapshot.
func (h *Handler) Detail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("nodeID"), 10, 64)
	if err != nil || id == 0 {
		httputil.BadRequest(c, "Invalid node id")
		return
	}
	var node models.CO2Node
	if err := h.db.First(&node, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			httputil.NotFound(c, "Node not found")
		} else {
			httputil.InternalError(c, "Failed to load node")
		}
		return
	}
	httputil.SuccessResponse(c, node)
}
