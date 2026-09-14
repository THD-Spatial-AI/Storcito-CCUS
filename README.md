# CCUS App
### Carbon Capture, Utilisation & Storage Assessment Platform

**CCUS App** is a geospatial platform for planning CO₂ transport networks. Users
pick industrial emission sources and storage or utilisation sinks from a
catalogue of European facilities, then let CO2RouteX screen candidate
connections, route them by pipeline, truck or railway, and cost each route.
Results are stored per model and shown on an interactive map.

The application is part of the **STORCITO** ecosystem at TH Deggendorf.

---

## Overview

### Core capabilities

- **Node catalogue** — 14 600+ CO₂ point sources across Germany, the Netherlands and Norway, filtered by country, region, city, emitter category and annual emissions
- **Interactive map** — OpenLayers + MapLibre GL, with nodes sized by annual flux, location search and bookmarks
- **Six-step configurator** — model setup → node selection → routes → costs → review → save
- **Route discovery** — CO2RouteX screens source-sink pairs, then routes them with A\* over a resistance raster (pipeline), OSM road networks (truck) or station distances (railway)
- **Transport costing** — pipeline CAPEX scaled by route resistance; truck and railway distance tariffs
- **Source browser** — the full upstream STORE_CO2 record per facility, including annual emission history
- **Workspaces & groups** — organise models into workspaces; share with Keycloak-managed groups
- **Real-time notifications** — SSE push + Asynq background jobs for run status
- **Admin dashboard** — user, model, feedback and webservice management with role-based access
- **Nine languages** — English, German, Dutch, French, Spanish, Italian, Polish, Czech, Portuguese

---

## Architecture

### Data flow

1. **Authentication**: Frontend → Keycloak (OAuth2/OIDC) → backend validates token → Redis session
2. **Catalogue import**: `POST /co2-nodes/import` pulls point sources from the STORE_CO2 API into `co2_nodes`, mapped to CO2RouteX node types
3. **Model creation**: User picks nodes → ids stored on the model config as `co2_node_ids`
4. **Routing run**: Backend builds `node_metrics.xlsx` from the selected nodes and drives the CO2RouteX chain — connections → pipeline/truck/railway routing → pipeline/container costs — passing the workbook forward at each stage
5. **Progress**: Each stage is tracked in `co2routex_jobs`; the browser polls the run and shows per-stage status
6. **Results**: Routes are parsed back into `co2routex_routes` with distance, mean route resistance and cost, then drawn on the map

### Upstream services

| Service | Port | Role |
|---|---|---|
| **STORE_CO2** | 8020 | Point-source catalogue: facilities, emissions history, node types |
| **CO2RouteX** | 8010 | Connection generation, multi-modal routing and cost modelling |

Both are separate repositories; the backend talks to them over HTTP and needs
only their URLs (`STORECO2_URL`, `CO2ROUTEX_URL`).

### Technology stack

**Frontend**
- React 19 + TypeScript 5.8
- Vite 7 for build tooling
- TailwindCSS 4 + Radix UI components (`@spatialhub/ui`)
- TanStack Query 5 for server state, Zustand 5 for client state
- OpenLayers 10 + MapLibre GL JS 5 (2D mapping)
- TanStack Virtual for the large node lists
- React Router 7 with lazy-loaded routes

**Backend**
- Go 1.25 + Gin web framework
- GORM with PostgreSQL driver
- Asynq (Redis-backed) for background jobs
- Excelize for the CO2RouteX workbook exchange
- Server-Sent Events (SSE) for real-time push
- Keycloak OIDC token validation

**Platform Core** (included in this repository)
- `platform-core/auth-service` — authentication microservice
- `platform-core/webservice` — job dispatcher and capacity manager
- `infrastructure/platform` — shared Go libraries (server, database, worker, email, security)
- `infrastructure/common` — shared domain models
- `libs/` — shared React component libraries (`@spatialhub/ui`, `auth`, `forms`, `i18n`)

**Infrastructure**
- PostgreSQL 15 + PostGIS
- Keycloak 26 for OAuth2/OIDC
- Redis 7 for sessions, caching, pub/sub and the task queue
- Nginx reverse proxy
- Docker Compose orchestration

---

## Installation & setup

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
| `STORECO2_HOST/PORT` or `STORECO2_URL` | Point-source catalogue API |
| `CO2ROUTEX_HOST/PORT` or `CO2ROUTEX_URL` | Routing and cost API |
| `CALLBACK_SECRET` | Shared secret for compute callbacks |

The frontend reads `VITE_API_BASE_URL` and, optionally,
`VITE_CARTO_BASEMAP_API_KEY` for the CARTO basemaps.

---

## Project structure

```
.
├── app/
│   ├── backend/              # Go API server (Gin, GORM, Asynq)
│   │   ├── cmd/              # Entrypoints: main, migrate, seed
│   │   ├── migrations/       # SQL migrations
│   │   └── internal/
│   │       ├── co2routex/    # Routing chain: workbook, stages, results
│   │       ├── storeco2/     # Point-source catalogue client
│   │       └── handler/      # HTTP handlers
│   └── frontend/             # React SPA (Vite, TypeScript)
│       └── src/
│           ├── features/
│           │   ├── co2-nodes/      # Catalogue, selector, routing, costs
│           │   ├── configurator/   # Six-step model wizard
│           │   ├── interactive-map/
│           │   └── model-dashboard/
│           ├── components/
│           └── i18n/               # Nine locales
├── platform-core/            # Platform services (auth-service, webservice, geoserver)
├── infrastructure/           # Shared Go libraries (common, platform)
├── libs/                     # Shared React component libraries
├── nginx/                    # Reverse proxy config
├── go.work                   # Go workspace tying the modules together
└── Makefile                  # Developer workflow commands
```

---

## License

See `LICENSE`.
