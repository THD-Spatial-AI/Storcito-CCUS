package routes

import (
	"github.com/gin-gonic/gin"

	co2sourceshandler "spatialhub_backend/internal/handler/co2sources"
)

func registerCO2SourceRoutes(api *gin.RouterGroup, handler *co2sourceshandler.Handler) {
	if handler == nil {
		return
	}
	api.GET("/co2-sources", handler.List)
	api.GET("/co2-sources/stats", handler.Stats)
	api.GET("/co2-sources/node-types", handler.NodeTypes)
	// Slashes force a query param.
	api.GET("/co2-sources/detail", handler.ByID)
}
