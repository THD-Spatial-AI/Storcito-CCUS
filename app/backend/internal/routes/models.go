package routes

import (
	"github.com/gin-gonic/gin"
	modelhandler "spatialhub_backend/internal/model/handler"
	resulthandler "spatialhub_backend/internal/result/handler"
)

func registerModelRoutes(api *gin.RouterGroup, modelHandler *modelhandler.ModelHandler, resultHandler *resulthandler.ResultHandler) {
	api.GET("/models/stats", modelHandler.GetModelStats)
	api.GET("/models", modelHandler.GetModels)
	api.POST("/models", modelHandler.CreateModel)
	api.PATCH("/models/bulk-move", modelHandler.BulkMoveModels)
	api.GET(routeModelByID, modelHandler.GetModel)
	api.PUT(routeModelByID, modelHandler.UpdateModel)
	api.DELETE(routeModelByID, modelHandler.DeleteModel)
	api.PUT(routeModelByID+"/activation", modelHandler.UpdateModelActivation)
	api.PATCH(routeModelByID+"/move", modelHandler.MoveModel)
	api.POST(routeModelByID+"/share", modelHandler.ShareModel)
	api.POST(routeModelByID+"/inputs", modelHandler.UploadModelInputs)
	api.GET(routeModelByID+"/results", resultHandler.GetModelResults)
	api.GET(routeModelByID+"/download", resultHandler.DownloadModelResult)
	api.POST("/calculation/start/:id", modelHandler.StartCalculation)
	api.GET("/results/:id/layer", resultHandler.GetResultLayer)
}
