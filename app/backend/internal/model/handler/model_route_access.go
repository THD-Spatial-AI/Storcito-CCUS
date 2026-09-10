package model

import (
	"github.com/gin-gonic/gin"
	"platform.local/common/pkg/constants"
	"platform.local/common/pkg/httputil"
)

// Route access.
func (h *ModelHandler) RouteAccess(edit bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := httputil.GetUserContext(c)
		if !ok {
			c.Abort()
			return
		}
		if edit {
			if _, ok := h.fetchModelWithEditPermission(c, user.UserID, c.Param("id")); !ok {
				c.Abort()
				return
			}
		} else {
			model, ok := h.fetchModel(c, c.Param("id"))
			if !ok {
				c.Abort()
				return
			}
			if user.AccessLevel != constants.AccessLevelExpert && !h.newModelService().UserHasModelAccessByEmail(user.UserID, user.Email, model) {
				httputil.Forbidden(c, "You don't have permission to view this model")
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
