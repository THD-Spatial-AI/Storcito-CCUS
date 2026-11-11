# Multi-stage Go build.
# Build from the repo root.
FROM golang:1.24-alpine AS gobuilder

WORKDIR /app
ENV GOTOOLCHAIN=auto

# Install build deps
RUN apk add --no-cache build-base ca-certificates git

# Shared modules first.
COPY infrastructure/common /infrastructure/common
COPY infrastructure/platform /infrastructure/platform

# Cache modules
COPY app/backend/go.mod app/backend/go.sum ./
RUN go mod download

# Copy source
COPY app/backend/. .

# Build the binaries.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/bin/server ./cmd/main.go
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/bin/migrate ./cmd/migrate/migration.go
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/bin/seed ./cmd/seed
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/bin/seed-co2 ./cmd/seed-co2

# Build the frontend.
FROM node:20-alpine AS febuilder
# Repo layout kept.
WORKDIR /build

# Build shared libs.
COPY libs/i18n libs/i18n
COPY libs/ui libs/ui
COPY libs/forms libs/forms
COPY libs/auth libs/auth
RUN for lib in i18n ui forms auth; do (cd libs/$lib && npm install --legacy-peer-deps && npm run build); done

WORKDIR /build/app/frontend
COPY app/frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY app/frontend .
# Basemap key.
ARG VITE_CARTO_BASEMAP_API_KEY=
RUN npm run build

# Ubuntu runtime image.
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binaries.
COPY --from=gobuilder /app/bin/server /app/server
COPY --from=gobuilder /app/bin/migrate /app/migrate
COPY --from=gobuilder /app/bin/seed /app/seed
COPY --from=gobuilder /app/bin/seed-co2 /app/seed-co2

# Copy frontend dist
COPY --from=febuilder /build/app/frontend/dist /app/www

# Copy migrations
COPY --from=gobuilder /app/migrations /app/migrations

# Fallback .env.
COPY app/backend/.env.example /app/.env

# Copy entrypoint script
COPY app/backend/entrypoint.sh /app/entrypoint.sh

# Non-root user and storage.
RUN useradd -r -s /bin/sh appuser && \
    mkdir -p /app/storage/data && \
    chmod +x /app/server /app/migrate /app/seed /app/seed-co2 /app/entrypoint.sh && \
    chown -R appuser:appuser /app

# Expose port
EXPOSE 8000

# Environment
ENV APP_HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/app/server", "--health-check"]

# Root fixes permissions, then drops.
ENTRYPOINT ["/app/entrypoint.sh"]
