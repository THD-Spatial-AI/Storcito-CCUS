package models

import (
	"time"

	"gorm.io/datatypes"
)

// CO2RouteX node types.
const (
	NodeTypeCement        = "cement"
	NodeTypeRefinery      = "refinery"
	NodeTypeWasteToEnergy = "waste_to_energy"
	NodeTypeStorage       = "storage"
	NodeTypeUtilisation   = "utilisation"
	NodeTypeTransport     = "transport"
)

// One worksheet row.
type CO2Node struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"column:node_name;size:255" json:"node_name"`

	// Workbook identifier.
	NodeID string `gorm:"column:node_id;not null;size:255" json:"node_id"`

	Longitude float64  `gorm:"not null" json:"longitude"`
	Latitude  float64  `gorm:"not null" json:"latitude"`
	Altitude  *float64 `json:"altitude"`

	// Flux or capacity.
	AnnualFlux *float64 `gorm:"column:annual_flux" json:"annual_flux"`

	NodeType    string  `gorm:"column:node_type;not null;size:64" json:"node_type"`
	Industry    *string `gorm:"column:industry;size:128" json:"industry,omitempty"`
	CountryCode *string `gorm:"column:country_code;size:8" json:"country_code"`
	Source      string  `gorm:"not null;size:64;default:'co2routex'" json:"source"`

	Metadata datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CO2Node) TableName() string { return "co2_nodes" }

// IsEmitter produces CO2.
func (n CO2Node) IsEmitter() bool {
	switch n.NodeType {
	case NodeTypeCement, NodeTypeRefinery, NodeTypeWasteToEnergy:
		return true
	}
	return false
}

// IsSink absorbs CO2.
func (n CO2Node) IsSink() bool {
	return n.NodeType == NodeTypeStorage || n.NodeType == NodeTypeUtilisation
}

// Model-to-node link.
type ModelCO2Node struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ModelID   uint      `gorm:"column:model_id;not null;index" json:"model_id"`
	CO2NodeID uint      `gorm:"column:co2_node_id;not null" json:"co2_node_id"`
	CreatedAt time.Time `json:"created_at"`

	Node *CO2Node `gorm:"foreignKey:CO2NodeID" json:"node,omitempty"`
}

func (ModelCO2Node) TableName() string { return "model_co2_nodes" }
