package routes

import (
	"github.com/gin-gonic/gin"

	memehandler "spatialhub_backend/internal/handler/meme"
	modelhandler "spatialhub_backend/internal/model/handler"
)

func registerMEMERoutes(api *gin.RouterGroup, handler *memehandler.Handler, modelHandler *modelhandler.ModelHandler) {
	if handler == nil {
		return
	}
	api.GET("/meme/health", handler.Health)
	api.GET("/meme/jobs/:jobID", handler.Status)
	api.GET("/meme/jobs/:jobID/result", handler.Result)
	api.POST(routeModelByID+"/meme/run", modelHandler.RouteAccess(true), handler.Run)
}
