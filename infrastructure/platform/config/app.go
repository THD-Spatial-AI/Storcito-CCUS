package config

import (
	"os"

	goredis "github.com/redis/go-redis/v9"

	"platform.local/platform/auth"
	"platform.local/platform/email"
)

// Service shares config.
type Service struct {
	Auth              auth.Config
	RedisConfig       goredis.Options
	AppPort           string
	AppHost           string
	AppURL            string
	AppEnv            string
	AppTimezone       string
	CookieDomain      string
	SessionTTLMinutes int
}

// ServiceFromEnv reads env.
func ServiceFromEnv() (Service, error) {
	if err := LoadEnvOnce(".", ".."); err != nil {
		return Service{}, err
	}
	redisDB, err := RequireEnvInt("REDIS_DATABASE")
	if err != nil {
		return Service{}, err
	}
	sessionTTL, err := GetEnvInt("SESSION_TTL_MINUTES", 60)
	if err != nil {
		return Service{}, err
	}
	return Service{
		Auth:              AuthConfigFromEnv(),
		RedisConfig:       RedisOptionsFromEnv(redisDB),
		AppPort:           os.Getenv("APP_PORT"),
		AppHost:           os.Getenv("APP_HOST"),
		AppURL:            os.Getenv("APP_URL"),
		AppEnv:            GetEnv("APP_ENV", "development"),
		AppTimezone:       GetEnv("APP_TIMEZONE", "UTC"),
		CookieDomain:      os.Getenv("COOKIE_DOMAIN"),
		SessionTTLMinutes: sessionTTL,
	}, nil
}

// SMTPConfig maps mailer.
func (s EmailSettings) SMTPConfig() email.SMTPConfig {
	return email.SMTPConfig{
		Host:      s.SMTPHost,
		Port:      s.SMTPPort,
		Username:  s.SMTPUsername,
		Password:  s.SMTPPassword,
		FromEmail: s.SMTPFromEmail,
		FromName:  s.SMTPFromName,
		UseTLS:    s.SMTPUseTLS,
	}
}
