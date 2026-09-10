package co2nodes

import (
	"context"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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
	if err := query.Order("node_id asc").Find(&nodes).Error; err != nil {
		httputil.InternalError(c, "Failed to load CO2 nodes")
		return
	}

	httputil.SuccessResponse(c, gin.H{"items": nodes, "total": len(nodes)})
}

type importRequest struct {
	Country string  `json:"country"`
	MinCO2T float64 `json:"min_co2_t"`
	BBox    string  `json:"bbox"`
	Limit   int     `json:"limit"`
	Offset  int     `json:"offset"`
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
	if req.Limit <= 0 {
		req.Limit = 500
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	fetched, err := h.store.Nodes(ctx, storeco2.NodeQuery{
		Country: req.Country,
		MinCO2T: req.MinCO2T,
		BBox:    req.BBox,
		Limit:   req.Limit,
		Offset:  req.Offset,
	})
	if err != nil {
		httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
		return
	}
	if len(fetched) == 0 {
		httputil.SuccessResponse(c, gin.H{"imported": 0, "total": h.count()})
		return
	}

	// Add industry classification.
	industries := h.industryByID(ctx, req)

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
			Industry:     industries[node.NodeID],
			CountryCode:  node.CountryCode,
			State:        cleanState(node.State, node.CountryCode),
			Municipality: node.Municipality,
			Source:       sourceStoreCO2,
		})
	}

	// Re-runnable.
	err = h.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source"}, {Name: "node_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"node_name", "longitude", "latitude", "altitude",
			"annual_flux", "node_type", "industry", "country_code",
			"state", "municipality", "updated_at",
		}),
	}).CreateInBatches(&rows, 200).Error
	if err != nil {
		httputil.InternalError(c, "Failed to save imported nodes")
		return
	}

	httputil.SuccessResponse(c, gin.H{"imported": len(rows), "total": h.count()})
}

func (h *Handler) count() int64 {
	var total int64
	h.db.Model(&models.CO2Node{}).Count(&total)
	return total
}

// industryByID maps IDs.
func (h *Handler) industryByID(ctx context.Context, req importRequest) map[string]*string {
	page, err := h.store.PointSources(ctx, storeco2.PointSourceQuery{
		Country: req.Country,
		MinCO2T: req.MinCO2T,
		BBox:    req.BBox,
		Limit:   req.Limit,
		Offset:  req.Offset,
	})
	if err != nil {
		return map[string]*string{}
	}
	industries := make(map[string]*string, len(page.Items))
	for _, source := range page.Items {
		industries[source.EntityID] = source.Industry
	}
	return industries
}
