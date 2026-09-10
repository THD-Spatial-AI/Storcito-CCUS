package model

import (
	"time"

	"spatialhub_backend/internal/events"
	backendModels "spatialhub_backend/internal/models"

	commonModels "platform.local/common/pkg/models"

	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Store holds the model queries.
type Store struct {
	db *gorm.DB
}

// NewStore builds a Store.
func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

// DB exposes the raw handle.
func (s *Store) DB() *gorm.DB {
	return s.db
}

// Basic CRUD.

// FindByID loads one model.
func (s *Store) FindByID(id string) (*commonModels.Model, error) {
	var model commonModels.Model
	err := s.db.Where("id = ?", id).First(&model).Error
	return &model, err
}

// FindByIDPreloaded preloads members and groups.
func (s *Store) FindByIDPreloaded(id string) (*commonModels.Model, error) {
	var model commonModels.Model
	err := s.db.
		Preload("Workspace.Members").
		Preload("Workspace.Groups").
		Where("id = ?", id).
		First(&model).Error
	return &model, err
}

// Create inserts from a field map.
func (s *Store) Create(modelMap map[string]interface{}) error {
	return s.db.Model(&commonModels.Model{}).Create(&modelMap).Error
}

// Update applies a field map.
func (s *Store) Update(model *commonModels.Model, updates map[string]interface{}) error {
	return s.db.Model(model).Updates(updates).Error
}

// PatchByID updates fields, not status.
func (s *Store) PatchByID(modelID uint, updates map[string]interface{}) error {
	return s.db.Model(&commonModels.Model{}).Where("id = ?", modelID).Updates(updates).Error
}

// FindActiveModels projects in-flight models.
func (s *Store) FindActiveModels() ([]commonModels.Model, error) {
	var models []commonModels.Model
	err := s.db.
		Select("id", "webservice_id", "status", "calculation_started_at").
		Where("status IN ?", []string{commonModels.ModelStatusQueue, commonModels.ModelStatusRunning}).
		Find(&models).Error
	return models, err
}

// TransitionStatus guards the status change; false on a lost race.
func (s *Store) TransitionStatus(modelID uint, from []string, to string, extra map[string]interface{}) (bool, error) {
	updates := map[string]interface{}{
		"status":     to,
		"updated_at": time.Now().UTC(),
	}
	for k, v := range extra {
		updates[k] = v
	}
	q := s.db.Model(&commonModels.Model{}).Where("id = ?", modelID)
	if len(from) > 0 {
		q = q.Where("status IN ?", from)
	}
	res := q.Updates(updates)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// TransitionStatusTx also writes the outbox event.
func (s *Store) TransitionStatusTx(modelID uint, from []string, to string, extra map[string]interface{}, ev *events.OutboxEvent) (bool, error) {
	var moved bool
	err := s.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":     to,
			"updated_at": time.Now().UTC(),
		}
		for k, v := range extra {
			updates[k] = v
		}
		q := tx.Model(&commonModels.Model{}).Where("id = ?", modelID)
		if len(from) > 0 {
			q = q.Where("status IN ?", from)
		}
		res := q.Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		moved = res.RowsAffected > 0
		if moved {
			return events.EnqueueTx(tx, ev)
		}
		return nil
	})
	return moved, err
}

// HardDelete drops the row.
func (s *Store) HardDelete(model *commonModels.Model) error {
	return s.db.Unscoped().Delete(model).Error
}

// UpdateParentModelID orphans the children.
func (s *Store) UpdateParentModelID(modelID uint) error {
	return s.db.Model(&commonModels.Model{}).
		Where("parent_model_id = ?", modelID).
		Update("parent_model_id", nil).Error
}

// Queries.

// CountByUserID counts owned models.
func (s *Store) CountByUserID(userID string) (int64, error) {
	var count int64
	err := s.db.Model(&commonModels.Model{}).
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Count(&count).Error
	return count, err
}

// CountByUserIDAndStatus counts per status.
func (s *Store) CountByUserIDAndStatus(userID, status string) (int64, error) {
	var count int64
	err := s.db.Model(&commonModels.Model{}).
		Where("user_id = ? AND status = ? AND deleted_at IS NULL", userID, status).
		Count(&count).Error
	return count, err
}

// CountByUserIDGrouped counts every status.
func (s *Store) CountByUserIDGrouped(userID string) (total int64, byStatus map[string]int64, err error) {
	byStatus = make(map[string]int64)
	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	err = s.db.Model(&commonModels.Model{}).
		Select("status, COUNT(*) as count").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Group("status").
		Scan(&rows).Error
	if err != nil {
		return 0, nil, err
	}
	for _, r := range rows {
		byStatus[r.Status] = r.Count
		total += r.Count
	}
	return total, byStatus, nil
}

// FindByIDs loads many models.
func (s *Store) FindByIDs(ids []uint) ([]commonModels.Model, error) {
	var models []commonModels.Model
	err := s.db.Where("id IN ?", ids).Find(&models).Error
	return models, err
}

// Workspace access.

// IsDefaultWorkspace tests the default.
func (s *Store) IsDefaultWorkspace(userID string, workspaceID uint) (bool, error) {
	var workspace commonModels.Workspace
	err := s.db.Session(&gorm.Session{Logger: s.db.Logger.LogMode(gormlogger.Silent)}).
		Where("user_id = ? AND is_default = ? AND id = ?", userID, true, workspaceID).
		First(&workspace).Error
	if err == nil {
		return true, nil
	}
	if err == gorm.ErrRecordNotFound {
		return false, nil
	}
	return false, err
}

// GetDefaultWorkspace loads the default.
func (s *Store) GetDefaultWorkspace(userID string) (*commonModels.Workspace, error) {
	var workspace commonModels.Workspace
	err := s.db.Where("user_id = ? AND is_default = ?", userID, true).First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

// Model sharing.

// CreateModelShare inserts a share.
func (s *Store) CreateModelShare(share *commonModels.ModelShare) error {
	return s.db.Create(share).Error
}

// DeleteModelShare drops a share.
func (s *Store) DeleteModelShare(modelID, shareID uint) (bool, error) {
	result := s.db.
		Where("id = ? AND model_id = ?", shareID, modelID).
		Delete(&commonModels.ModelShare{})
	return result.RowsAffected > 0, result.Error
}

// FindModelShareByModelAndEmail loads one share.
func (s *Store) FindModelShareByModelAndEmail(modelID uint, email string) (*commonModels.ModelShare, error) {
	var share commonModels.ModelShare
	err := s.db.Where("model_id = ? AND email = ?", modelID, email).First(&share).Error
	return &share, err
}

// CountModelSharesByModelAndUser counts shares; user_id may be unbackfilled.
func (s *Store) CountModelSharesByModelAndUser(modelID uint, userID string) int64 {
	var count int64
	s.db.Model(&commonModels.ModelShare{}).
		Where("model_id = ? AND user_id = ?", modelID, userID).
		Count(&count)
	return count
}

// CountModelSharesByModelAndUserOrEmail counts by either key.
func (s *Store) CountModelSharesByModelAndUserOrEmail(modelID uint, userID, email string) int64 {
	var count int64
	q := s.db.Model(&commonModels.ModelShare{}).Where("model_id = ?", modelID)
	if email != "" {
		q = q.Where("user_id = ? OR LOWER(email) = LOWER(?)", userID, email)
	} else {
		q = q.Where("user_id = ?", userID)
	}
	q.Count(&count)
	return count
}

// PluckSharedModelIDsByUser lists shared ids.
func (s *Store) PluckSharedModelIDsByUser(userID string) []uint {
	var ids []uint
	s.db.Model(&commonModels.ModelShare{}).
		Where("user_id = ?", userID).
		Pluck("model_id", &ids)
	return ids
}

// IsWorkspaceSharedWithUser tests membership.
func (s *Store) IsWorkspaceSharedWithUser(workspaceID uint, email string) bool {
	var count int64
	s.db.Model(&commonModels.WorkspaceMember{}).
		Where("workspace_id = ? AND LOWER(email) = LOWER(?)", workspaceID, email).
		Count(&count)
	return count > 0
}

// IsWorkspaceSharedWithUserGroups tests group access.
func (s *Store) IsWorkspaceSharedWithUserGroups(workspaceID uint, groupIDs []string) bool {
	var count int64
	s.db.Model(&commonModels.WorkspaceGroup{}).
		Where("workspace_id = ? AND group_id IN ?", workspaceID, groupIDs).
		Count(&count)
	return count > 0
}

// Workspace helpers.

// CountWorkspaceOwner tests ownership.
func (s *Store) CountWorkspaceOwner(workspaceID uint, userID string) int64 {
	var count int64
	s.db.Model(&commonModels.Workspace{}).
		Where("id = ? AND user_id = ?", workspaceID, userID).
		Count(&count)
	return count
}

// CountWorkspaceMember tests membership.
func (s *Store) CountWorkspaceMember(workspaceID uint, userID string) int64 {
	var count int64
	s.db.Model(&commonModels.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Count(&count)
	return count
}

// CountWorkspaceGroupAccess tests group access.
func (s *Store) CountWorkspaceGroupAccess(workspaceID uint, groupIDs []string) int64 {
	var count int64
	s.db.Model(&commonModels.WorkspaceGroup{}).
		Where("workspace_id = ? AND group_id IN ?", workspaceID, groupIDs).
		Count(&count)
	return count
}

// FindWorkspaceByIDSelect loads chosen columns.
func (s *Store) FindWorkspaceByIDSelect(workspaceID uint) (*commonModels.Workspace, error) {
	var ws commonModels.Workspace
	err := s.db.Select("id, user_id, user_email, is_default").
		Where("id = ?", workspaceID).First(&ws).Error
	return &ws, err
}

// UpdateWorkspaceUserID sets the owner.
func (s *Store) UpdateWorkspaceUserID(ws *commonModels.Workspace, userID string) error {
	return s.db.Model(ws).Update("user_id", userID).Error
}

// PluckOwnedWorkspaceIDs lists owned ids.
func (s *Store) PluckOwnedWorkspaceIDs(workspaceIDs []uint, userID string) []uint {
	var ids []uint
	s.db.Model(&commonModels.Workspace{}).
		Where("id IN ? AND user_id = ?", workspaceIDs, userID).
		Pluck("id", &ids)
	return ids
}

// PluckMemberWorkspaceIDs lists member ids.
func (s *Store) PluckMemberWorkspaceIDs(workspaceIDs []uint, userID string) []uint {
	var ids []uint
	s.db.Model(&commonModels.WorkspaceMember{}).
		Where("workspace_id IN ? AND user_id = ?", workspaceIDs, userID).
		Pluck("workspace_id", &ids)
	return ids
}

// PluckGroupWorkspaceIDs lists group ids.
func (s *Store) PluckGroupWorkspaceIDs(workspaceIDs []uint, groupIDs []string) []uint {
	var ids []uint
	s.db.Model(&commonModels.WorkspaceGroup{}).
		Where("workspace_id IN ? AND group_id IN ?", workspaceIDs, groupIDs).
		Pluck("workspace_id", &ids)
	return ids
}

// Sync helpers.

// SyncWorkspaceMemberUserID backfills by email.
func (s *Store) SyncWorkspaceMemberUserID(userID, email string) {
	s.db.Model(&commonModels.WorkspaceMember{}).
		Where("email = ? AND (user_id = ? OR user_id IS NULL)", email, "").
		Update("user_id", userID)

	s.db.Model(&commonModels.ModelShare{}).
		Where("email = ? AND (user_id = ? OR user_id IS NULL)", email, "").
		Update("user_id", userID)
}

// FindUserIDByEmail resolves an email.
func (s *Store) FindUserIDByEmail(email string) string {
	var userID string
	s.db.Model(&commonModels.WorkspaceMember{}).
		Select("user_id").
		Where("email = ? AND user_id <> ''", email).
		Limit(1).
		Scan(&userID)
	if userID == "" {
		s.db.Model(&commonModels.ModelShare{}).
			Select("user_id").
			Where("email = ? AND user_id <> ''", email).
			Limit(1).
			Scan(&userID)
	}
	return userID
}

// Model limits.

// GetModelLimit loads the limit.
func (s *Store) GetModelLimit(accessLevel string) (*backendModels.ModelLimit, error) {
	var limit backendModels.ModelLimit
	err := s.db.Where("access_level = ?", accessLevel).First(&limit).Error
	if err != nil {
		return nil, err
	}
	return &limit, nil
}

// Calculation helpers.

// FindModelWithWorkspace preloads the workspace.
func (s *Store) FindModelWithWorkspace(modelIDParam string) (*commonModels.Model, error) {
	var model commonModels.Model
	err := s.db.Preload("Workspace").First(&model, modelIDParam).Error
	return &model, err
}
