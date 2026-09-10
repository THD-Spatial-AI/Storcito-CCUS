-- Drill-down filter columns.

BEGIN;

ALTER TABLE co2_nodes ADD COLUMN IF NOT EXISTS state VARCHAR(128);
ALTER TABLE co2_nodes ADD COLUMN IF NOT EXISTS municipality VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_co2_nodes_state ON co2_nodes (state);
CREATE INDEX IF NOT EXISTS idx_co2_nodes_municipality ON co2_nodes (municipality);

COMMIT;
