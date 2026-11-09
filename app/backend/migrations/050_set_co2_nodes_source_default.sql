-- STORE_CO2 nodes.

BEGIN;

ALTER TABLE co2_nodes ALTER COLUMN source SET DEFAULT 'store_co2';
COMMENT ON TABLE co2_nodes IS 'STORE_CO2 node catalogue';

COMMIT;
