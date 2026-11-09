package config

import (
	"fmt"
	"os"
	"strings"

	platformconfig "platform.local/platform/config"
)

const (
	defaultWebserviceURL = "http://localhost:8082"
	defaultGeoserverURL  = "http://localhost:8083"
	defaultStoreCO2Host  = "localhost"
	defaultStoreCO2Port  = "8020"
)

type Config struct {
	platformconfig.Service
	Database             platformconfig.DatabaseConfig
	Email                platformconfig.EmailSettings
	AuthServiceURL       string // Auth service.
	WebserviceServiceURL string // Webservice.
	GeoserverServiceURL  string // GeoServer control plane.
	GeoserverPublicURL   string // Public WMS URL.
	StoreCO2URL          string // STORE_CO2 API.
	SurveyDataDir        string // RUB survey sheets.
	CallbackSecret       string // Callback secret.
}

func LoadFromEnv() (*Config, error) {
	service, err := platformconfig.ServiceFromEnv()
	if err != nil {
		return nil, err
	}
	return &Config{
		Service:              service,
		Email:                platformconfig.EmailSettingsFromEnv(),
		Database:             platformconfig.AppDatabaseFromEnv(),
		AuthServiceURL:       platformconfig.GetEnv("AUTH_SERVICE_URL", "http://auth-service:8001"),
		WebserviceServiceURL: normalizeWebserviceURL(platformconfig.GetEnv("WEBSERVICE_SERVICE_URL", defaultWebserviceURL)),
		GeoserverServiceURL:  platformconfig.GetEnv("GEOSERVER_SERVICE_URL", defaultGeoserverURL),
		GeoserverPublicURL:   platformconfig.GetEnv("GEOSERVER_PUBLIC_URL", defaultGeoserverURL),
		StoreCO2URL:          storeCO2URL(),
		SurveyDataDir:        strings.TrimSpace(os.Getenv("SURVEY_DATA_DIR")),
		CallbackSecret:       os.Getenv("CALLBACK_SECRET"),
	}, nil
}

// 0.0.0.0 to localhost.
func normalizeWebserviceURL(raw string) string {
	if raw == "" {
		return defaultWebserviceURL
	}
	switch raw {
	case "0.0.0.0", "http://0.0.0.0":
		return defaultWebserviceURL
	case "0.0.0.0:8085", "http://0.0.0.0:8085":
		return "http://localhost:8085"
	case "0.0.0.0:8082", "http://0.0.0.0:8082":
		return defaultWebserviceURL
	}
	return raw
}

// storeCO2URL prefers STORECO2_URL.
func storeCO2URL() string {
	if url := strings.TrimSpace(os.Getenv("STORECO2_URL")); url != "" {
		return strings.TrimRight(url, "/")
	}
	host := platformconfig.GetEnv("STORECO2_HOST", defaultStoreCO2Host)
	port := platformconfig.GetEnv("STORECO2_PORT", defaultStoreCO2Port)
	return fmt.Sprintf("http://%s:%s", host, port)
}
