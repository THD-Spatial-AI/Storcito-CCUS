package routes

import (
	"github.com/gin-gonic/gin"

	routinghandler "spatialhub_backend/internal/handler/routing"
	modelhandler "spatialhub_backend/internal/model/handler"
)

func registerRoutingRoutes(api *gin.RouterGroup, handler *routinghandler.Handler, modelHandler *modelhandler.ModelHandler) {
	if handler == nil {
		return
	}
	api.POST("/routing/preview", handler.Preview)
	api.GET("/routing/runs/:runID", handler.Status)
	api.GET("/routing/runs/:runID/workbook", handler.Workbook)
	api.DELETE("/routing/runs/:runID", handler.Cancel)
	api.POST(routeModelByID+"/routing/run", modelHandler.RouteAccess(true), handler.Run)
	api.GET(routeModelByID+"/routing/routes", modelHandler.RouteAccess(false), handler.Routes)
}
