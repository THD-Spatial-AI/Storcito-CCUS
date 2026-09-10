-- Entity IDs exceed 64 chars.

BEGIN;

ALTER TABLE co2_nodes ALTER COLUMN node_id TYPE VARCHAR(255);

COMMIT;
