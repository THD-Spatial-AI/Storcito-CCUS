package co2routex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Stage input.
type Upload struct {
	Name string
	Path string
	Data []byte
}

type filePart struct {
	field string
	file  Upload
}

func workbookPart(data []byte) filePart {
	return filePart{"workbook", Upload{Name: "node_metrics.xlsx", Data: data}}
}

func (c *Client) submit(ctx context.Context, endpoint string, files []filePart, fields map[string]string, options map[string]any) (*Job, error) {
	encoded, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}
	reader, writer := io.Pipe()
	multi := multipart.NewWriter(writer)
	done := make(chan struct{})
	go func() {
		defer close(done)
		err := func() error {
			for _, item := range files {
				part, err := multi.CreateFormFile(item.field, filepath.Base(item.file.Name))
				if err != nil {
					return err
				}
				if item.file.Path == "" {
					_, err = io.Copy(part, bytes.NewReader(item.file.Data))
				} else {
					var file *os.File
					file, err = os.Open(item.file.Path)
					if err == nil {
						_, err = io.Copy(part, file)
						_ = file.Close()
					}
				}
				if err != nil {
					return err
				}
			}
			for key, value := range fields {
				if err := multi.WriteField(key, value); err != nil {
					return err
				}
			}
			if len(options) > 0 {
				if err := multi.WriteField("options", string(encoded)); err != nil {
					return err
				}
			}
			return multi.Close()
		}()
		_ = writer.CloseWithError(err)
	}()
	job, err := c.postJob(ctx, endpoint, multi.FormDataContentType(), reader)
	_ = reader.Close()
	<-done
	return job, err
}

func (c *Client) RoutePipeline(ctx context.Context, workbook []byte, raster Upload, options map[string]any) (*Job, error) {
	return c.submit(ctx, "/routing/pipeline", []filePart{workbookPart(workbook), {"raster", raster}}, nil, options)
}

func (c *Client) RouteTruck(ctx context.Context, workbook []byte, networks []Upload, countries []string, options map[string]any) (*Job, error) {
	if len(networks) == 0 || len(networks) != len(countries) {
		return nil, fmt.Errorf("each road network needs a country code")
	}
	files := []filePart{workbookPart(workbook)}
	for _, network := range networks {
		files = append(files, filePart{"networks", network})
	}
	return c.submit(ctx, "/routing/truck", files, map[string]string{"network_countries": strings.Join(countries, ",")}, options)
}

func (c *Client) RailwayStationDistances(ctx context.Context, railway, stations Upload, options map[string]any) (*Job, error) {
	return c.submit(ctx, "/routing/railway/station-distances", []filePart{{"railway", railway}, {"stations", stations}}, nil, options)
}

func (c *Client) RouteRailway(ctx context.Context, workbook []byte, stations, distances Upload, options map[string]any) (*Job, error) {
	return c.submit(ctx, "/routing/railway/request", []filePart{workbookPart(workbook), {"stations", stations}, {"distances", distances}}, nil, options)
}

func (c *Client) PipelineCosts(ctx context.Context, workbook []byte, options map[string]any) (*Job, error) {
	return c.submit(ctx, "/costs/pipeline", []filePart{workbookPart(workbook)}, nil, options)
}

func (c *Client) ContainerCosts(ctx context.Context, workbook []byte, modes []string, options map[string]any) (*Job, error) {
	if len(modes) == 0 {
		return nil, fmt.Errorf("select container transport modes")
	}
	seen := map[string]bool{}
	for _, mode := range modes {
		if (mode != "truck" && mode != "railway") || seen[mode] {
			return nil, fmt.Errorf("invalid container mode %q", mode)
		}
		seen[mode] = true
	}
	return c.submit(ctx, "/costs/container", []filePart{workbookPart(workbook)}, map[string]string{"modes": strings.Join(modes, ",")}, options)
}

func (c *Client) Await(ctx context.Context, job *Job) (*Job, error) {
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	for {
		if job == nil || job.JobID == "" {
			return nil, fmt.Errorf("missing upstream job ID")
		}
		switch job.Status {
		case "completed":
			return job, nil
		case "failed":
			detail := "stage failed"
			if job.Error != nil {
				detail = *job.Error
			}
			return job, fmt.Errorf("%s", detail)
		case "queued", "running":
		default:
			return job, fmt.Errorf("unknown upstream status %q", job.Status)
		}
		select {
		case <-ctx.Done():
			return job, ctx.Err()
		case <-ticker.C:
		}
		polled, err := c.GetJob(ctx, job.JobID)
		if err != nil {
			return job, err
		}
		job = polled
	}
}

func (c *Client) OutputWorkbook(ctx context.Context, job *Job) ([]byte, error) {
	name, _ := job.Summary["costed_workbook"].(string)
	if name == "" {
		for _, output := range job.Outputs {
			if strings.HasSuffix(strings.ToLower(output.Name), ".xlsx") {
				if name != "" {
					return nil, fmt.Errorf("ambiguous workbook outputs in %s", job.Stage)
				}
				name = output.Name
			}
		}
	}
	for _, output := range job.Outputs {
		if output.Name == name {
			return c.DownloadFile(ctx, job.JobID, name)
		}
	}
	return nil, fmt.Errorf("missing workbook output in %s", job.Stage)
}
