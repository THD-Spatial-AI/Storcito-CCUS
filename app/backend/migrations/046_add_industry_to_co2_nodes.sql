-- Industry for filtering.

BEGIN;

ALTER TABLE co2_nodes ADD COLUMN IF NOT EXISTS industry VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_co2_nodes_industry ON co2_nodes (industry);

COMMIT;
