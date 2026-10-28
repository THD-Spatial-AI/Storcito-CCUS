package survey

import (
	"github.com/gin-gonic/gin"

	"platform.local/common/pkg/httputil"

	"spatialhub_backend/internal/survey"
)

// Handler serves survey regions.
type Handler struct {
	regions []survey.Region
}

// NewHandler holds loaded regions.
func NewHandler(regions []survey.Region) *Handler {
	if regions == nil {
		regions = []survey.Region{}
	}
	return &Handler{regions: regions}
}

// Regions lists survey regions.
func (h *Handler) Regions(c *gin.Context) {
	httputil.SuccessResponse(c, gin.H{
		"regions":         h.regions,
		"min_respondents": survey.MinRespondents,
	})
}
