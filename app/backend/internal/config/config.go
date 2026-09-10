package config

import (
	"fmt"
	"os"
	"strings"

	"platform.local/platform/auth"
	platformconfig "platform.local/platform/config"

	goredis "github.com/redis/go-redis/v9"
)

const (
	defaultWebserviceURL = "http://localhost:8082"
	defaultGeoserverURL  = "http://localhost:8083"
	defaultCO2RouteXHost = "localhost"
	defaultCO2RouteXPort = "8010"
	defaultStoreCO2Host  = "localhost"
	defaultStoreCO2Port  = "8020"
)

type Config struct {
	Auth                 auth.Config
	RedisConfig          goredis.Options
	AppPort              string
	AppHost              string
	AppURL               string
	AppEnv               string
	AppTimezone          string
	CookieDomain         string
	Database             platformconfig.DatabaseConfig
	SessionTTLMinutes    int // Minutes.
	Email                platformconfig.EmailSettings
	AuthServiceURL       string // Auth service.
	WebserviceServiceURL string // Webservice.
	GeoserverServiceURL  string // GeoServer control plane.
	GeoserverPublicURL   string // Public WMS URL.
	CO2RouteXURL         string // CO2RouteX API.
	StoreCO2URL          string // STORE_CO2 API.
	CallbackSecret       string // Callback secret.
}

func LoadFromEnv() (*Config, error) {
	if err := platformconfig.LoadEnvOnce(".", ".."); err != nil {
		return nil, err
	}

	redisDB, err := platformconfig.RequireEnvInt("REDIS_DATABASE")
	if err != nil {
		return nil, err
	}

	sessionTTL, err := platformconfig.GetEnvInt("SESSION_TTL_MINUTES", 60)
	if err != nil {
		return nil, err
	}

	emailSettings := platformconfig.EmailSettingsFromEnv()

	cfg := &Config{
		Auth:                 platformconfig.AuthConfigFromEnv(),
		RedisConfig:          platformconfig.RedisOptionsFromEnv(redisDB),
		AppPort:              os.Getenv("APP_PORT"),
		AppHost:              os.Getenv("APP_HOST"),
		AppURL:               os.Getenv("APP_URL"),
		AppEnv:               platformconfig.GetEnv("APP_ENV", "development"),
		AppTimezone:          platformconfig.GetEnv("APP_TIMEZONE", "UTC"),
		CookieDomain:         os.Getenv("COOKIE_DOMAIN"),
		SessionTTLMinutes:    sessionTTL,
		Email:                emailSettings,
		Database:             platformconfig.AppDatabaseFromEnv(),
		AuthServiceURL:       platformconfig.GetEnv("AUTH_SERVICE_URL", "http://auth-service:8001"),
		WebserviceServiceURL: normalizeWebserviceURL(platformconfig.GetEnv("WEBSERVICE_SERVICE_URL", defaultWebserviceURL)),
		GeoserverServiceURL:  platformconfig.GetEnv("GEOSERVER_SERVICE_URL", defaultGeoserverURL),
		GeoserverPublicURL:   platformconfig.GetEnv("GEOSERVER_PUBLIC_URL", defaultGeoserverURL),
		CO2RouteXURL:         co2routeXURL(),
		StoreCO2URL:          storeCO2URL(),
		CallbackSecret:       os.Getenv("CALLBACK_SECRET"),
	}
	return cfg, nil
}

// normalizeWebserviceURL rewrites 0.0.0.0 to localhost.
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

// co2routeXURL prefers CO2ROUTEX_URL.
func co2routeXURL() string {
	if url := strings.TrimSpace(os.Getenv("CO2ROUTEX_URL")); url != "" {
		return strings.TrimRight(url, "/")
	}
	host := platformconfig.GetEnv("CO2ROUTEX_HOST", defaultCO2RouteXHost)
	port := platformconfig.GetEnv("CO2ROUTEX_PORT", defaultCO2RouteXPort)
	return fmt.Sprintf("http://%s:%s", host, port)
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
