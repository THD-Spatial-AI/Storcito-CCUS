package models

import (
	"time"

	"gorm.io/datatypes"
)

// CO2RouteX stage names.
const (
	StageConnections     = "connections"
	StageRoutingPipeline = "routing_pipeline"
	StageRoutingTruck    = "routing_truck"
	StageRoutingRailway  = "routing_railway"
	StageCostsPipeline   = "costs_pipeline"
	StageCostsContainer  = "costs_container"
)

// CO2RouteX job states.
const (
	JobStatusQueued    = "queued"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
)

// One stage run.
type CO2RouteXJob struct {
	ID      uint `gorm:"primaryKey" json:"id"`
	ModelID uint `gorm:"column:model_id;not null;index" json:"model_id"`

	// Upstream job identifier.
	JobID string `gorm:"column:job_id;not null;size:128" json:"job_id"`

	Stage  string  `gorm:"not null;size:64" json:"stage"`
	Status string  `gorm:"not null;size:16;default:'queued'" json:"status"`
	Error  *string `gorm:"type:text" json:"error,omitempty"`

	Summary datatypes.JSON `gorm:"type:jsonb" json:"summary,omitempty"`
	Outputs datatypes.JSON `gorm:"type:jsonb" json:"outputs,omitempty"`

	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (CO2RouteXJob) TableName() string { return "co2routex_jobs" }

// IsFinished is terminal.
func (j CO2RouteXJob) IsFinished() bool {
	return j.Status == JobStatusCompleted || j.Status == JobStatusFailed
}

// One node-pair result.
type CO2RouteXRoute struct {
	ID      uint    `gorm:"primaryKey" json:"id"`
	ModelID uint    `gorm:"column:model_id;not null;index" json:"model_id"`
	JobID   *string `gorm:"column:job_id;size:128" json:"job_id,omitempty"`

	FromNodeID string `gorm:"column:from_node_id;not null;size:64" json:"from_node_id"`
	ToNodeID   string `gorm:"column:to_node_id;not null;size:64" json:"to_node_id"`
	Mode       string `gorm:"not null;size:32" json:"mode"`

	// Routing outputs.
	DistanceKm        *float64 `gorm:"column:distance_km" json:"distance_km,omitempty"`
	AverageResistance *float64 `gorm:"column:average_resistance" json:"average_resistance,omitempty"`

	// Cost outputs.
	CostEurPerTKm *float64 `gorm:"column:cost_eur_per_t_km" json:"cost_eur_per_t_km,omitempty"`
	CapexEur      *float64 `gorm:"column:capex_eur" json:"capex_eur,omitempty"`

	Metadata  datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

func (CO2RouteXRoute) TableName() string { return "co2routex_routes" }
