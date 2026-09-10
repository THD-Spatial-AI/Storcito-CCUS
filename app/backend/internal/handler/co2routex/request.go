package co2routex

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	client "spatialhub_backend/internal/co2routex"
)

type runRequest struct {
	NodeIDs []uint `json:"node_ids"`
	client.Inputs
}

func readRequest(c *gin.Context) (runRequest, string, error) {
	var req runRequest
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512<<20)
	if err := c.Request.ParseMultipartForm(8 << 20); err != nil {
		return req, "", fmt.Errorf("send routing settings and dataset files as multipart form data (maximum 512 MiB)")
	}
	defer func() { _ = c.Request.MultipartForm.RemoveAll() }()
	if err := json.Unmarshal([]byte(c.PostForm("request")), &req); err != nil {
		return req, "", fmt.Errorf("invalid routing settings")
	}
	directory, err := os.MkdirTemp("", "ccus-routing-")
	if err != nil {
		return req, "", err
	}
	valid := false
	defer func() {
		if !valid {
			_ = os.RemoveAll(directory)
		}
	}()
	for field, headers := range c.Request.MultipartForm.File {
		if field != "networks" && len(headers) != 1 {
			return req, "", fmt.Errorf("upload one %s file", field)
		}
		for i, header := range headers {
			ext := strings.ToLower(filepath.Ext(header.Filename))
			switch field {
			case "raster":
				if ext != ".tif" && ext != ".tiff" {
					return req, "", fmt.Errorf("raster must be a GeoTIFF")
				}
			case "distances":
				if ext != ".csv" {
					return req, "", fmt.Errorf("station distances must be CSV")
				}
			case "networks", "railway", "stations":
				if ext != ".gpkg" && ext != ".geojson" {
					return req, "", fmt.Errorf("networks and stations must be GeoPackage or GeoJSON")
				}
			default:
				return req, "", fmt.Errorf("unknown routing file %q", field)
			}
			name := fmt.Sprintf("%s_%d%s", field, i, ext)
			path := filepath.Join(directory, name)
			source, err := header.Open()
			if err != nil {
				return req, "", err
			}
			target, err := os.Create(path)
			if err != nil {
				_ = source.Close()
				return req, "", err
			}
			n, copyErr := io.Copy(target, source)
			_ = source.Close()
			closeErr := target.Close()
			if copyErr != nil {
				return req, "", copyErr
			}
			if closeErr != nil {
				return req, "", closeErr
			}
			if n == 0 {
				return req, "", fmt.Errorf("%s is empty", field)
			}
			file := client.Upload{Name: name, Path: path}
			switch field {
			case "raster":
				req.Raster = file
			case "networks":
				req.Networks = append(req.Networks, file)
			case "railway":
				req.Railway = file
			case "stations":
				req.Stations = file
			case "distances":
				req.Distances = file
			}
		}
	}
	if err := req.Inputs.Validate(); err != nil {
		return req, "", err
	}
	valid = true
	return req, directory, nil
}
