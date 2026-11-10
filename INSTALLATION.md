# Installation & Development

How to set up, run and develop the CCUS App locally. For an overview of the project, see the [README](README.md).

## Installation & Setup

### Prerequisites

- Docker & Docker Compose
- Go 1.25+
- Node.js 20+

### Quick start

```bash
make setup
```

`make setup` runs the full sequence: copies `.env.example` files, installs npm +
Go dependencies, pulls Docker images, starts PostgreSQL + Redis, initialises
Keycloak, starts platform services, and runs migrations + seed. Everything is
vendored here — `platform-core/`, `infrastructure/` and `libs/` are already in
the repository, so setup pulls no external repos.

### Step by step

```bash
make env-setup        # copy .env files (edit them before proceeding)
make install          # install dependencies
make up-db            # start Postgres + Redis
make db-create        # create the app database
make up-keycloak
make init-keycloak    # configure realm + client secrets
make up-services      # auth-service, webservice
make migrate
make seed
```

### Running locally

```bash
cd app/backend && go run cmd/main.go     # backend
cd app/frontend && npm run dev           # frontend (new terminal)
```

Open `http://localhost:3000`. Default credentials after seeding:

| Field | Value |
|---|---|
| Email | `admin@spatialai.de` |
| Password | `12345678` |

### Docker Compose

```bash
make up-app      # start the CCUS app (frontend + backend)
make down-app    # stop
make logs-app    # follow logs
```

Services exposed:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Keycloak: `http://localhost:8080`

---

## Development

### Makefile targets

| Command | Description |
|---|---|
| `make help` | List all targets |
| `make up` | Start Platform Core (Postgres, Redis, Keycloak, auth-service, webservice) |
| `make down` | Stop Platform Core |
| `make up-app` | Start the CCUS app (frontend + backend) |
| `make migrate` | Run backend DB migrations |
| `make seed` | Seed the database |
| `make install` | Install all npm + Go dependencies |

### Environment variables

Copy `app/backend/.env.example` to `app/backend/.env` and adjust:

| Variable | Description |
|---|---|
| `APP_URL` | Public URL of the backend |
| `DB_HOST/PORT/DATABASE` | PostgreSQL connection |
| `REDIS_HOST/PORT` | Redis connection |
| `KEYCLOAK_URL` / `KEYCLOAK_REALM` | Keycloak OIDC endpoint |
| `STORECO2_HOST/PORT` or `STORECO2_URL` | Point-source catalogue and routing API |
| `CALLBACK_SECRET` | Shared secret for compute callbacks |

The frontend reads `VITE_API_BASE_URL` and, optionally,
`VITE_CARTO_BASEMAP_API_KEY` for the CARTO basemaps.
