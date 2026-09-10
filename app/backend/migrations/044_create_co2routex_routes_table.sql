-- Per-pair CO2RouteX results.

BEGIN;

CREATE TABLE IF NOT EXISTS co2routex_routes (
    id           SERIAL PRIMARY KEY,
    model_id     INTEGER      NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    job_id       VARCHAR(128),

    from_node_id VARCHAR(64)  NOT NULL,
    to_node_id   VARCHAR(64)  NOT NULL,
    mode         VARCHAR(32)  NOT NULL,

    -- Routing outputs.
    distance_km         DOUBLE PRECISION,
    average_resistance  DOUBLE PRECISION,

    -- Cost outputs.
    cost_eur_per_t_km   DOUBLE PRECISION,
    capex_eur           DOUBLE PRECISION,

    metadata     JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique per pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_co2routex_routes_pair
    ON co2routex_routes (model_id, mode, from_node_id, to_node_id);

CREATE INDEX IF NOT EXISTS idx_co2routex_routes_model ON co2routex_routes (model_id);

COMMENT ON TABLE co2routex_routes IS 'Per node-pair routing and cost results';
COMMENT ON COLUMN co2routex_routes.mode IS 'pipeline, truck or railway';
COMMENT ON COLUMN co2routex_routes.distance_km IS 'Routed distance, not straight line';
COMMENT ON COLUMN co2routex_routes.average_resistance IS 'Mean raster resistance along the route';

COMMIT;
