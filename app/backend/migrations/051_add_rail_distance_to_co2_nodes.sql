-- Distance to rail.

BEGIN;

ALTER TABLE co2_nodes ADD COLUMN IF NOT EXISTS rail_distance_m DOUBLE PRECISION;

COMMIT;
