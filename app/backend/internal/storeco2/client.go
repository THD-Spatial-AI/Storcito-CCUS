package storeco2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Client reads the API.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient targets baseURL.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

// Node is one sheet row.
type Node struct {
	NodeID       string   `json:"node_id"`
	NodeName     string   `json:"node_name"`
	Longitude    float64  `json:"longitude"`
	Latitude     float64  `json:"latitude"`
	Altitude     *float64 `json:"altitude"`
	AnnualFlux   *float64 `json:"annual_flux"`
	NodeType     string   `json:"node_type"`
	CountryCode  *string  `json:"country_code"`
	State        *string  `json:"state"`
	Municipality *string  `json:"municipality"`
}

type nodeList struct {
	Nodes []Node `json:"nodes"`
	Total int    `json:"total"`
}

// PointSource is one facility.
type PointSource struct {
	EntityID           string   `json:"entity_id"`
	Name               *string  `json:"name"`
	Operator           *string  `json:"operator"`
	Country            *string  `json:"country"`
	State              *string  `json:"state"`
	Municipality       *string  `json:"municipality"`
	Latitude           *float64 `json:"latitude"`
	Longitude          *float64 `json:"longitude"`
	CO2TAnnual         *float64 `json:"co2_t_annual"`
	CapacityMW         *float64 `json:"capacity_mw"`
	Granularity        *string  `json:"granularity"`
	Industry           *string  `json:"industry"`
	CaptureGroup       *string  `json:"capture_group"`
	CaptureApplication *string  `json:"capture_application"`
	Technology         *string  `json:"technology"`
	FuelNorm           *string  `json:"fuel_norm"`
	SourceClass        *string  `json:"source_class"`
	CO2Source          *string  `json:"co2_source"`
	Status             *string  `json:"status"`
	CO2Year            *int     `json:"co2_year"`
	CommissioningYear  *int     `json:"commissioning_year"`
	CO2IsEstimated     *bool    `json:"co2_is_estimated"`
}

// PointSourcePage is one page.
type PointSourcePage struct {
	Items  []PointSource `json:"items"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}

// PointSourceQuery filters sources.
type PointSourceQuery struct {
	Country         string
	CaptureGroup    string
	MinCO2T         float64
	BBox            string
	Search          string
	WithCoordinates *bool
	Limit           int
	Offset          int
}

// CountryStat is per country.
type CountryStat struct {
	Country    string  `json:"country"`
	Sources    int     `json:"sources"`
	CO2TAnnual float64 `json:"co2_t_annual"`
}

// CaptureGroupStat is per group.
type CaptureGroupStat struct {
	CaptureGroup string  `json:"capture_group"`
	Sources      int     `json:"sources"`
	CO2TAnnual   float64 `json:"co2_t_annual"`
}

// Stats summarises the dataset.
type Stats struct {
	TotalSources    int                `json:"total_sources"`
	WithCoordinates int                `json:"with_coordinates"`
	ByCountry       []CountryStat      `json:"by_country"`
	ByCaptureGroup  []CaptureGroupStat `json:"by_capture_group"`
}

// Health is service state.
type Health struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Sources int    `json:"sources"`
}

// NodeQuery filters the import.
type NodeQuery struct {
	Country string
	MinCO2T float64
	BBox    string
	Limit   int
	Offset  int
}

// Health probes the API.
func (c *Client) Health(ctx context.Context) (*Health, error) {
	var out Health
	if err := c.getJSON(ctx, "/health", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Nodes fetches sources.
func (c *Client) Nodes(ctx context.Context, query NodeQuery) ([]Node, error) {
	values := url.Values{}
	if query.Country != "" {
		values.Set("country", query.Country)
	}
	if query.MinCO2T > 0 {
		values.Set("min_co2_t", strconv.FormatFloat(query.MinCO2T, 'f', -1, 64))
	}
	if query.BBox != "" {
		values.Set("bbox", query.BBox)
	}
	if query.Limit > 0 {
		values.Set("limit", strconv.Itoa(query.Limit))
	}
	if query.Offset > 0 {
		values.Set("offset", strconv.Itoa(query.Offset))
	}

	path := "/nodes"
	if encoded := values.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var out nodeList
	if err := c.getJSON(ctx, path, &out); err != nil {
		return nil, err
	}
	return out.Nodes, nil
}

// PointSources pages the catalogue.
func (c *Client) PointSources(ctx context.Context, query PointSourceQuery) (*PointSourcePage, error) {
	values := url.Values{}
	if query.Country != "" {
		values.Set("country", query.Country)
	}
	if query.CaptureGroup != "" {
		values.Set("capture_group", query.CaptureGroup)
	}
	if query.MinCO2T > 0 {
		values.Set("min_co2_t", strconv.FormatFloat(query.MinCO2T, 'f', -1, 64))
	}
	if query.BBox != "" {
		values.Set("bbox", query.BBox)
	}
	if query.Search != "" {
		values.Set("search", query.Search)
	}
	if query.WithCoordinates != nil {
		values.Set("with_coordinates", strconv.FormatBool(*query.WithCoordinates))
	}
	if query.Limit > 0 {
		values.Set("limit", strconv.Itoa(query.Limit))
	}
	if query.Offset > 0 {
		values.Set("offset", strconv.Itoa(query.Offset))
	}

	path := "/point-sources"
	if encoded := values.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var out PointSourcePage
	if err := c.getJSON(ctx, path, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PointSource fetches one facility.
func (c *Client) PointSource(ctx context.Context, entityID string) (*PointSource, int, error) {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet, c.baseURL+"/point-sources/"+url.PathEscape(entityID), nil,
	)
	if err != nil {
		return nil, 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("store_co2 unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, http.StatusNotFound, nil
	}
	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, resp.StatusCode, fmt.Errorf("store_co2 returned %s: %s", resp.Status, strings.TrimSpace(string(payload)))
	}
	var out PointSource
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, 0, err
	}
	return &out, http.StatusOK, nil
}

// Stats summarises the dataset.
func (c *Client) Stats(ctx context.Context) (*Stats, error) {
	var out Stats
	if err := c.getJSON(ctx, "/stats", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// NodeTypes lists the taxonomy.
func (c *Client) NodeTypes(ctx context.Context) ([]string, error) {
	var out struct {
		NodeTypes []string `json:"node_types"`
	}
	if err := c.getJSON(ctx, "/node-types", &out); err != nil {
		return nil, err
	}
	return out.NodeTypes, nil
}

func (c *Client) getJSON(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("store_co2 unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		detail := strings.TrimSpace(string(payload))
		if detail == "" {
			return fmt.Errorf("store_co2 returned %s", resp.Status)
		}
		return fmt.Errorf("store_co2 returned %s: %s", resp.Status, detail)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
