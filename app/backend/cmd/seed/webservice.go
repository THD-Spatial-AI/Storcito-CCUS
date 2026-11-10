package main

import (
	"log"
	"strconv"

	"gorm.io/gorm"
	platformconfig "platform.local/platform/config"
	"platform.local/common/pkg/models"
)

// Compute VM services.
type computeService struct {
	name, hostEnv, portEnv, defaultHost string
	defaultPort                         int
}

var computeServices = []computeService{
	{name: "STORE_CO2", hostEnv: "STORECO2_HOST", portEnv: "STORECO2_PORT", defaultHost: "localhost", defaultPort: 8020},
	{name: "AdOpT-NET0", hostEnv: "ADOPTNET0_HOST", portEnv: "ADOPTNET0_PORT", defaultHost: "localhost", defaultPort: 8030},
}

func seedWebservice(db *gorm.DB) {
	for _, svc := range computeServices {
		seedComputeService(db, svc)
	}
}

func seedComputeService(db *gorm.DB, svc computeService) {
	name := svc.name
	host := platformconfig.GetEnv(svc.hostEnv, svc.defaultHost)
	port, err := strconv.Atoi(platformconfig.GetEnv(svc.portEnv, strconv.Itoa(svc.defaultPort)))
	if err != nil {
		log.Printf("Invalid %s: %v", svc.portEnv, err)
		return
	}

	var existing models.WebserviceInstance
	result := db.Where("name = ?", name).First(&existing)
	switch result.Error {
	case gorm.ErrRecordNotFound:
		ws := models.WebserviceInstance{Name: &name, IP: host, Port: port, Protocol: "http", Status: "active", Available: true}
		if err := db.Create(&ws).Error; err != nil {
			log.Printf("Failed to seed %s: %v", name, err)
			return
		}
		log.Printf("Seeded webservice: %s (%s:%d)", name, host, port)
	case nil:
		// Follow env changes.
		existing.IP, existing.Port = host, port
		if err := db.Save(&existing).Error; err != nil {
			log.Printf("Failed to update %s: %v", name, err)
			return
		}
		log.Printf("Updated webservice: %s (%s:%d)", name, host, port)
	default:
		log.Printf("Failed to look up %s: %v", name, result.Error)
	}
}
