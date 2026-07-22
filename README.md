# Universal Project Template

A reusable, domain-independent monorepo template for building geospatial web
applications. Everything the plumbing needs — authentication, roles &
permissions, workspaces, an area-of-interest driven **model** workflow,
background jobs, GeoServer result publishing, notifications, and a React
frontend — is included, with **no business domain baked in**.

The bundled example app (`app/`) shows the full flow end to end with a
neutral sample result, so the whole stack runs on day one. Swap in your own
processing module and ship.

Everything is vendored in this repository — `platform-core/`, `infrastructure/`,
and `libs/` are already here, so setup does **not** pull any external repos.

---

## Quick start

**Prerequisites:** Docker + Docker Compose, Go 1.24+, Node 20+, `make`.

```bash
git clone <your-fork> && cd <your-fork>
make setup
```

`make setup` runs the entire first-time setup in order:

| Step | What it does |
|------|--------------|
| `env-setup`   | Creates `.env` files from each `.env.example` |
| `install`     | Installs & builds shared libs (`libs/*`), frontend deps, and tidies Go modules |
| `pull-images` | Pulls the base Docker images (Postgres, Redis, Keycloak) |
| `up-db`       | Starts Postgres + Redis |
| `db-create`   | Creates the app database |
| `up-keycloak` + `init-keycloak` | Starts Keycloak and configures the realm & client secrets |
| `up-services` | Builds & starts `auth-service` and `webservice` |
| `migrate` + `seed` | Runs DB migrations and seeds the admin user |

When it finishes, start the app:

```bash
cd app/backend && go run cmd/main.go     # backend
cd app/frontend && npm run dev           # frontend (new terminal)
```

Then open **http://localhost:3000**.

Default login: `admin@spatialai.de` / `12345678`.

---

## Common commands

```bash
make help               # list all targets

# Platform Core (Keycloak, Postgres, Redis, auth-service, webservice)
make up                 # start
make down               # stop
make logs               # follow logs

# Example app
make up-app      # build + start the full app stack
make down-app    # stop
make logs-app    # follow logs

# Database
make start-postgres     # start Postgres only
make migrate            # run DB migrations
make seed               # seed the database
```

---

## Repository layout

| Path | Purpose |
|------|---------|
| `app/backend`  | Example app backend (Go / Gin / GORM) |
| `app/frontend` | Example app frontend (React 19 + Vite) |
| `platform-core/`      | Shared Go services: `auth-service`, `webservice`, `geoserver` |
| `infrastructure/`     | Shared Go packages (`common`, `platform`) |
| `libs/`               | Shared React packages (`@spatialhub/*`) |
| `nginx/`              | Reverse-proxy configuration |
| `go.work`             | Go workspace tying the modules together |

---

## Adapting the template for another application

The template gives you the full plumbing; to build a different application you
adapt the domain-specific pieces around it. The main things you'll modify:

- **Payload / model** — extend the model and job payload with the fields your
  domain needs (`app/backend/internal/model` and `internal/payload`).
  Add, remove, or rename config parameters to match your use case.
- **Processing module** — replace the compute step that receives a job and
  produces a result. When a model is submitted the backend persists it and
  enqueues a job; `platform-core/webservice` reserves a registered compute
  instance, marks the model **running**, and sends the job to it. Your module
  *is* that compute instance — it accepts the job payload, produces its output,
  and POSTs a result back to the callback URL. Because the contract is a network
  call, it can be written in any language and deployed independently.
- **Result handling** — adjust how results are parsed, stored, and rendered to
  fit your output format (`internal/result`).
- **Frontend** — add or change the domain-specific panels under
  `app/frontend/src/features/`; the shared UI, auth, and dashboard pieces
  stay as-is.

Out of the box the processing step returns a **neutral sample result**, so the
whole flow is demonstrable before you plug in any domain code.

---

## License

See `LICENSE`. This template is a starting point — replace this README,
branding, and the example processing with your own.
