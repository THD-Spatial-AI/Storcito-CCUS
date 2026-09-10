package routes

import (
	"github.com/gin-gonic/gin"

	co2routexhandler "spatialhub_backend/internal/handler/co2routex"
	modelhandler "spatialhub_backend/internal/model/handler"
)

func registerCO2RouteXRoutes(api *gin.RouterGroup, handler *co2routexhandler.Handler, modelHandler *modelhandler.ModelHandler) {
	if handler == nil {
		return
	}
	api.POST("/co2routex/preview", handler.Preview)
	api.GET("/co2routex/runs/:runID", handler.Status)
	api.GET("/co2routex/runs/:runID/workbook", handler.Workbook)
	api.DELETE("/co2routex/runs/:runID", handler.Cancel)
	api.POST(routeModelByID+"/co2routex/run", modelHandler.RouteAccess(true), handler.Run)
	api.GET(routeModelByID+"/co2routex/routes", modelHandler.RouteAccess(false), handler.Routes)
}
