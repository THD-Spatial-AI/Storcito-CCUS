-- CO2RouteX node catalogue.

BEGIN;

CREATE TABLE IF NOT EXISTS co2_nodes (
    id            SERIAL PRIMARY KEY,
    node_id       VARCHAR(64)      NOT NULL,
    node_name     VARCHAR(255),
    longitude     DOUBLE PRECISION NOT NULL,
    latitude      DOUBLE PRECISION NOT NULL,
    altitude      DOUBLE PRECISION,
    annual_flux   DOUBLE PRECISION,
    node_type     VARCHAR(64)      NOT NULL,
    country_code  VARCHAR(8),
    source        VARCHAR(64)      NOT NULL DEFAULT 'co2routex',
    metadata      JSONB,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workbook matrix key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_co2_nodes_source_node_id
    ON co2_nodes (source, node_id);

CREATE INDEX IF NOT EXISTS idx_co2_nodes_node_type ON co2_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_co2_nodes_country ON co2_nodes (country_code);

-- WGS84 degrees only.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_co2_nodes_lonlat') THEN
        ALTER TABLE co2_nodes
          ADD CONSTRAINT chk_co2_nodes_lonlat
          CHECK (longitude BETWEEN -180 AND 180 AND latitude BETWEEN -90 AND 90);
    END IF;
END$$;

-- Nodes per model.
CREATE TABLE IF NOT EXISTS model_co2_nodes (
    id          SERIAL PRIMARY KEY,
    model_id    INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    co2_node_id INTEGER NOT NULL REFERENCES co2_nodes(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_co2_nodes
    ON model_co2_nodes (model_id, co2_node_id);

CREATE INDEX IF NOT EXISTS idx_model_co2_nodes_model ON model_co2_nodes (model_id);

COMMENT ON TABLE co2_nodes IS 'CO2RouteX node catalogue';
COMMENT ON COLUMN co2_nodes.node_id IS 'Workbook matrix identifier';
COMMENT ON COLUMN co2_nodes.node_type IS 'Emitter, storage or transport';
COMMENT ON COLUMN co2_nodes.annual_flux IS 'Emitter flux or sink capacity';
COMMENT ON TABLE model_co2_nodes IS 'Nodes per model run';

COMMIT;
