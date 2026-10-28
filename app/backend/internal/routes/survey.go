package routes

import (
	"github.com/gin-gonic/gin"

	surveyhandler "spatialhub_backend/internal/handler/survey"
)

func registerSurveyRoutes(api *gin.RouterGroup, handler *surveyhandler.Handler) {
	if handler == nil {
		return
	}
	api.GET("/survey/regions", handler.Regions)
}
