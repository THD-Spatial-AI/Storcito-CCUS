package co2nodes

import (
	"context"
	"errors"
	"fmt"
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

// Countries the application covers.
var importCountries = map[string]bool{"DE": true, "NL": true, "NO": true}

func inScope(nodes []storeco2.Node) []storeco2.Node {
	kept := make([]storeco2.Node, 0, len(nodes))
	for _, node := range nodes {
		if node.CountryCode != nil && importCountries[strings.ToUpper(*node.CountryCode)] {
			kept = append(kept, node)
		}
	}
	return kept
}

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

	// Deferred industry groups.
	excluded := map[string]int64{}
	if raw := strings.TrimSpace(c.Query("exclude_industry")); raw != "" {
		var skip []string
		for _, industry := range strings.Split(raw, ",") {
			if industry = strings.TrimSpace(industry); industry != "" {
				skip = append(skip, industry)
			}
		}
		if len(skip) > 0 {
			var counts []struct {
				Industry string
				Count    int64
			}
			if err := query.Session(&gorm.Session{}).Where("industry IN ?", skip).
				Select("industry, COUNT(*) AS count").Group("industry").Scan(&counts).Error; err != nil {
				httputil.InternalError(c, "Failed to load CO2 nodes")
				return
			}
			for _, row := range counts {
				excluded[row.Industry] = row.Count
			}
			query = query.Where("industry IS NULL OR industry NOT IN ?", skip)
		}
	}

	var nodes []models.CO2Node
	if err := query.Omit("metadata").Order("node_id asc").Find(&nodes).Error; err != nil {
		httputil.InternalError(c, "Failed to load CO2 nodes")
		return
	}

	httputil.SuccessResponse(c, gin.H{"items": nodes, "total": len(nodes), "excluded": excluded})
}

type importRequest struct {
	Country string   `json:"country"`
	MinCO2T *float64 `json:"min_co2_t"`
	All     bool     `json:"all"`
	BBox    string   `json:"bbox"`
	Limit   int      `json:"limit"`
	Offset  int      `json:"offset"`
}

type ImportOptions struct {
	Country string
	MinCO2T *float64
	All     bool
	BBox    string
	Limit   int
	Offset  int
}

type ImportResult struct {
	Imported       int    `json:"imported"`
	Sinks          int    `json:"sinks"`
	Removed        int64  `json:"removed"`
	Total          int64  `json:"total"`
	SourceTotal    int    `json:"source_total"`
	HasMore        bool   `json:"has_more"`
	NextOffset     int    `json:"next_offset"`
	DatasetVersion string `json:"dataset_version"`
}

var ErrInvalidImport = errors.New("invalid import bounds")
var ErrSaveImport = errors.New("failed to save imported nodes")

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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()

	result, err := ImportNodes(ctx, h.db, h.store, ImportOptions(req))
	switch {
	case errors.Is(err, ErrInvalidImport):
		httputil.BadRequest(c, "Invalid import bounds")
	case errors.Is(err, ErrSaveImport):
		httputil.InternalError(c, "Failed to save imported nodes")
	case err != nil:
		respondUpstream(c, err)
	default:
		httputil.SuccessResponse(c, result)
	}
}

// ImportNodes upserts STORE_CO2 nodes.
func ImportNodes(ctx context.Context, db *gorm.DB, store *storeco2.Client, req ImportOptions) (ImportResult, error) {
	if req.Limit < 0 || req.Limit > 10000 || req.Offset < 0 || (req.MinCO2T != nil && (math.IsNaN(*req.MinCO2T) || math.IsInf(*req.MinCO2T, 0) || *req.MinCO2T < 0)) {
		return ImportResult{}, ErrInvalidImport
	}
	if req.Limit == 0 {
		req.Limit = 1000
		req.All = true
	}
	minFlux := 0.0
	if req.MinCO2T != nil {
		minFlux = *req.MinCO2T
	}

	query := storeco2.NodeQuery{
		Country:    req.Country,
		MinCO2T:    minFlux,
		HasMinCO2T: req.MinCO2T != nil,
		BBox:       req.BBox,
		Limit:      req.Limit,
		Offset:     req.Offset,
	}
	page, err := store.ImportNodes(ctx, query, req.All)
	if err != nil {
		return ImportResult{}, err
	}
	// Full imports include sinks.
	var sinks []storeco2.Node
	if req.All && req.Offset == 0 {
		sinkPage, err := store.ImportSinks(ctx, storeco2.NodeQuery{Country: req.Country, BBox: req.BBox, Limit: req.Limit}, true)
		if err != nil {
			return ImportResult{}, err
		}
		sinks = sinkPage.Nodes
	}
	emitters, sinks := inScope(page.Nodes), inScope(sinks)
	fetched := append(emitters, sinks...)
	result := ImportResult{SourceTotal: page.Total, HasMore: page.HasMore, NextOffset: req.Offset, DatasetVersion: page.DatasetVersion}
	if len(fetched) == 0 {
		result.Total = countNodes(db)
		return result, nil
	}

	started := time.Now()
	rows := make([]models.CO2Node, 0, len(fetched))
	for _, node := range fetched {
		rows = append(rows, models.CO2Node{
			NodeID:         node.NodeID,
			Name:           node.NodeName,
			Longitude:      node.Longitude,
			Latitude:       node.Latitude,
			Altitude:       node.Altitude,
			AnnualFlux:     node.AnnualFlux,
			NodeType:       node.NodeType,
			Industry:       node.Industry,
			Metadata:       datatypes.JSON(node.Metadata),
			CountryCode:    node.CountryCode,
			State:          cleanState(node.State, node.CountryCode),
			Municipality:   node.Municipality,
			NUTS1:          node.NUTS1,
			NUTS2:          node.NUTS2,
			NUTS3:          node.NUTS3,
			Rural:          node.Rural,
			OperatingFrom:  node.OperatingFrom,
			OperatingUntil: node.OperatingUntil,
			Retired:        node.Retired,
			RailDistanceM:  node.RailDistanceM,
			Source:         sourceStoreCO2,
		})
	}
	// Prune removed nodes.
	prune := req.All && req.Offset == 0 && req.Country == "" && req.BBox == "" && req.MinCO2T == nil

	var removed int64
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "source"}, {Name: "node_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"node_name", "longitude", "latitude", "altitude",
				"annual_flux", "node_type", "industry", "country_code",
				"state", "municipality", "nuts1", "nuts2", "nuts3", "rural",
				"operating_from", "operating_until", "retired", "rail_distance_m",
				"metadata", "updated_at",
			}),
		}).CreateInBatches(&rows, 200).Error; err != nil {
			return err
		}
		if !prune {
			return nil
		}
		// Keep model nodes.
		res := tx.Exec(`DELETE FROM co2_nodes n
			WHERE n.source = ? AND n.updated_at < ?
			  AND NOT EXISTS (SELECT 1 FROM model_co2_nodes l WHERE l.co2_node_id = n.id)
			  AND NOT EXISTS (SELECT 1 FROM models m WHERE m.config->'parameters'->'co2_node_ids' @> to_jsonb(n.id))`,
			sourceStoreCO2, started)
		removed = res.RowsAffected
		return res.Error
	})
	if err != nil {
		return ImportResult{}, fmt.Errorf("%w: %v", ErrSaveImport, err)
	}

	result.Imported = len(emitters)
	result.Sinks = len(sinks)
	result.Removed = removed
	result.Total = countNodes(db)
	result.NextOffset = req.Offset + len(page.Nodes)
	return result, nil
}

func respondUpstream(c *gin.Context, err error) {
	var upstream *storeco2.HTTPError
	if errors.As(err, &upstream) && (upstream.StatusCode == 400 || upstream.StatusCode == 409 || upstream.StatusCode == 422) {
		c.JSON(upstream.StatusCode, gin.H{"error": upstream.Detail})
		return
	}
	httputil.BadGateway(c, "STORE_CO2 request failed: "+err.Error())
}

func countNodes(db *gorm.DB) int64 {
	var total int64
	db.Model(&models.CO2Node{}).Count(&total)
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
