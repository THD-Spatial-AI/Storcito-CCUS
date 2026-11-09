package config

import (
	platformconfig "platform.local/platform/config"
)

type Config struct {
	platformconfig.Service
	FrontendURL string
	Database    platformconfig.DatabaseConfig
	Email       EmailConfig
}

type EmailConfig struct {
	platformconfig.EmailSettings
	EnableNotifications           bool
	EnableBrowserNotifications    bool
	EmailVerificationRequired     bool
	VerificationTokenExpiryHours  int
	PasswordResetTokenExpiryHours int
}

func LoadFromEnv() (*Config, error) {
	service, err := platformconfig.ServiceFromEnv()
	if err != nil {
		return nil, err
	}
	return &Config{
		Service:     service,
		FrontendURL: platformconfig.GetEnv("FRONTEND_URL", "http://localhost:3000"),
		Email:       buildEmailConfig(platformconfig.EmailSettingsFromEnv()),
		Database:    platformconfig.DatabaseFromEnv(),
	}, nil
}

// buildEmailConfig constructs email configuration from environment
func buildEmailConfig(base platformconfig.EmailSettings) EmailConfig {
	verificationHours, err := platformconfig.GetEnvInt("VERIFICATION_TOKEN_EXPIRY_HOURS", 24)
	if err != nil {
		verificationHours = 24
	}
	resetHours, err := platformconfig.GetEnvInt("PASSWORD_RESET_TOKEN_EXPIRY_HOURS", 1)
	if err != nil {
		resetHours = 1
	}

	return EmailConfig{
		EmailSettings:                 base,
		EnableNotifications:           platformconfig.GetEnvBool("ENABLE_EMAIL_NOTIFICATIONS", false),
		EnableBrowserNotifications:    platformconfig.GetEnvBool("ENABLE_BROWSER_NOTIFICATIONS", false),
		EmailVerificationRequired:     platformconfig.GetEnvBool("EMAIL_VERIFICATION_REQUIRED", false),
		VerificationTokenExpiryHours:  verificationHours,
		PasswordResetTokenExpiryHours: resetHours,
	}
}
