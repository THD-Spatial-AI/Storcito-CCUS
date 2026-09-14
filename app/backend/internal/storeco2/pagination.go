package storeco2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Upstream failure.
type HTTPError struct {
	StatusCode int
	Detail     string
}

func (e *HTTPError) Error() string { return e.Detail }

func responseError(resp *http.Response) error {
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	var payload struct {
		Detail any `json:"detail"`
	}
	detail := strings.TrimSpace(string(data))
	if json.Unmarshal(data, &payload) == nil {
		if message, ok := payload.Detail.(string); ok {
			detail = message
		}
	}
	if detail == "" {
		detail = resp.Status
	}
	return &HTTPError{StatusCode: resp.StatusCode, Detail: detail}
}

// Complete import page.
func (c *Client) ImportNodes(ctx context.Context, query NodeQuery, all bool) (*NodePage, error) {
	if query.Limit == 0 {
		query.Limit = 1000
	}
	result := &NodePage{Nodes: []Node{}, Offset: query.Offset, Limit: query.Limit}
	seen := map[string]bool{}
	for {
		page, err := c.NodesPage(ctx, query)
		if err != nil {
			return nil, err
		}
		if page.DatasetVersion == "" || page.Offset != query.Offset || page.Limit <= 0 {
			return nil, fmt.Errorf("STORE_CO2 must provide versioned node pagination")
		}
		remaining := max(0, page.Total-page.Offset)
		if page.Total < 0 || len(page.Nodes) != min(page.Limit, remaining) || page.HasMore != (remaining > len(page.Nodes)) {
			return nil, fmt.Errorf("STORE_CO2 returned incomplete node pagination")
		}
		if result.DatasetVersion != "" && (page.DatasetVersion != result.DatasetVersion || page.Total != result.Total) {
			return nil, fmt.Errorf("STORE_CO2 dataset changed during import; retry")
		}
		result.Total, result.DatasetVersion = page.Total, page.DatasetVersion
		for _, node := range page.Nodes {
			if node.NodeID == "" || seen[node.NodeID] {
				return nil, fmt.Errorf("STORE_CO2 returned duplicate or empty node IDs")
			}
			if len(node.Metadata) == 0 || string(node.Metadata) == "null" {
				return nil, fmt.Errorf("STORE_CO2 omitted metadata for %s", node.NodeID)
			}
			seen[node.NodeID] = true
			result.Nodes = append(result.Nodes, node)
		}
		result.HasMore = page.HasMore
		if !all || !page.HasMore {
			return result, nil
		}
		if len(page.Nodes) == 0 {
			return nil, fmt.Errorf("STORE_CO2 pagination did not advance")
		}
		query.Offset += len(page.Nodes)
		query.DatasetVersion = page.DatasetVersion
	}
}
