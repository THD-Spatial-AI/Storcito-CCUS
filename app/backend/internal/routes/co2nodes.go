package routes

import (
	"github.com/gin-gonic/gin"

	co2nodeshandler "spatialhub_backend/internal/handler/co2nodes"
)

func registerCO2NodeRoutes(api *gin.RouterGroup, handler *co2nodeshandler.Handler) {
	if handler == nil {
		return
	}
	api.GET("/co2-nodes", handler.List)
	api.POST("/co2-nodes/import", handler.Import)
}
