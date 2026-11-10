# CCUS App
### Carbon Capture, Utilisation & Storage Assessment Platform

**CCUS App** is a geospatial platform for planning CO₂ transport networks. Users
pick industrial emission sources and storage or utilisation sinks from a
catalogue of European facilities, then let STORE_CO2 route each emitter to a
sink by pipeline, truck or railway, and cost each route.
Results are stored per model and shown on an interactive map.

The application is part of the **STORCITO** ecosystem at TH Deggendorf.

---

## Overview

### Core capabilities

- **Node catalogue** — 14 600+ CO₂ point sources across Germany, the Netherlands and Norway, filtered by country, region, city, emitter category and annual emissions
- **Interactive map** — OpenLayers + MapLibre GL, with nodes sized by annual flux, location search and bookmarks
- **Six-step configurator** — model setup → node selection → routes → costs → review → save
- **Route discovery** — STORE_CO2 floods once from every selected sink (Dijkstra over a resistance raster for pipelines, over OSM road or rail networks for containers), assigns each emitter a sink — greedily, or under sink capacity with Gurobi — and walks the assigned routes
- **Transport costing** — pipeline CAPEX scaled by route resistance; truck and railway distance tariffs
- **Source browser** — the full upstream STORE_CO2 record per facility, including annual emission history
- **Workspaces & groups** — organise models into workspaces; share with Keycloak-managed groups
- **Real-time notifications** — SSE push + Asynq background jobs for run status
- **Admin dashboard** — user, model, feedback and webservice management with role-based access
- **Ten languages** — English, German, Dutch, French, Spanish, Italian, Polish, Czech, Portuguese, Norwegian

---

## Architecture

### Data flow

1. **Authentication**: Frontend → Keycloak (OAuth2/OIDC) → backend validates token → Redis session
2. **Catalogue import**: `POST /co2-nodes/import` (or `make seed-co2`) pulls emitters and sinks from the STORE_CO2 API into `co2_nodes`
3. **Model creation**: User picks nodes → ids stored on the model config as `co2_node_ids`
4. **Routing run**: Backend sends the selected node ids to STORE_CO2 (`POST /routing/runs`), one job per transport mode; STORE_CO2 routes each country on its own raster or network and prices every route (pipeline design and CAPEX after Oeuvray et al., road and rail tariffs)
5. **Progress**: Each mode's job is tracked in `co2routex_jobs`; the browser polls the run and shows per-mode status
6. **Results**: Assigned routes are stored in `co2routex_routes` with distance, mean route resistance, cost and geometry, then drawn on the map

### Upstream services

| Service | Port | Role |
|---|---|---|
| **STORE_CO2** | 8020 | Point-source catalogue, emitter-to-sink routing and transport costs |

STORE_CO2 is a separate repository; the backend talks to it over HTTP and needs
only its URL (`STORECO2_URL`). Pipeline routing works wherever its resistance
rasters are present; road and rail need its OSM networks (`GET /routing/modes`
lists what each country can route).

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
- Excelize for the routing results workbook
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

## Getting Started

Installation, local development, Makefile targets and environment variables are described in [INSTALLATION.md](INSTALLATION.md). For a full local setup, run:

```bash
make setup
```

---

## Project structure

```
.
├── app/
│   ├── backend/              # Go API server (Gin, GORM, Asynq)
│   │   ├── cmd/              # Entrypoints: main, migrate, seed
│   │   ├── migrations/       # SQL migrations
│   │   └── internal/
│   │       ├── routing/      # STORE_CO2 routing runs
│   │       ├── storeco2/     # STORE_CO2 client
│   │       └── handler/      # HTTP handlers
│   └── frontend/             # React SPA (Vite, TypeScript)
│       └── src/
│           ├── features/
│           │   ├── co2-nodes/      # Catalogue, selector, routing, costs
│           │   ├── configurator/   # Six-step model wizard
│           │   ├── interactive-map/
│           │   └── model-dashboard/
│           ├── components/
│           └── i18n/               # Ten locales
├── platform-core/            # Platform services (auth-service, webservice, geoserver)
├── infrastructure/           # Shared Go libraries (common, platform)
├── libs/                     # Shared React component libraries
├── nginx/                    # Reverse proxy config
├── go.work                   # Go workspace tying the modules together
└── Makefile                  # Developer workflow commands
```

---

## Translations

The web interface is available in 10 languages: English, Czech, Dutch, French, German, Italian, Norwegian, Polish, Portuguese, Spanish. English is the source language. The other translations in `app/frontend/src/i18n/locales/` **were generated with AI** and have not been reviewed by native speakers, so they may contain errors. Corrections are welcome through issues or pull requests.

---

## Contributing

Bug reports, feature requests and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

---

## License

MIT License — Copyright (c) 2026 BigGeoData & Spatial AI, Technische Hochschule Deggendorf. See [LICENSE](LICENSE) for the full text.

> [!NOTE]
> This tool is under active development. Routes and costs are screening estimates from the STORE_CO2 models: they are not engineering designs or quotes, and they have not been validated against built projects. Features and performance may change in future releases.

---

## Acknowledgments

Developed by the **BigGeoData & Spatial AI** research group at Technische Hochschule Deggendorf. Source and sink data, capture costs and routing come from the **STORE_CO2** project.

This project is being developed in the context of the research project STORCITO — *Sustainable Transformation Of Rural Communities via Technical, social and Organizational innovations* (<https://cordis.europa.eu/project/id/101182153>). STORCITO is funded by the European Union's Horizon Europe research and innovation programme under grant agreement No. 101182153. Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or the European Research Executive Agency (REA). Neither the European Union nor the granting authority can be held responsible for them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/sponsors/storcito-logo-white.png">
  <img src=".github/assets/sponsors/storcito-logo-dark.png" alt="STORCITO" height="40">
</picture>
&nbsp;&nbsp;
<img src=".github/assets/sponsors/eu-funded.png" alt="Funded by the European Union" height="40">

Map data © OpenStreetMap contributors; base maps by CARTO.
