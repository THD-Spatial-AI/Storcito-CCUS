-- CO2RouteX job tracking.

BEGIN;

CREATE TABLE IF NOT EXISTS co2routex_jobs (
    id           SERIAL PRIMARY KEY,
    model_id     INTEGER      NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    job_id       VARCHAR(128) NOT NULL,
    stage        VARCHAR(64)  NOT NULL,
    status       VARCHAR(16)  NOT NULL DEFAULT 'queued',
    error        TEXT,
    summary      JSONB,
    outputs      JSONB,
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_co2routex_jobs_job_id ON co2routex_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_co2routex_jobs_model ON co2routex_jobs (model_id);

-- Poll unfinished jobs.
CREATE INDEX IF NOT EXISTS idx_co2routex_jobs_pending
    ON co2routex_jobs (status, id)
    WHERE status IN ('queued', 'running');

-- Mirrors upstream states.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_co2routex_jobs_status') THEN
        ALTER TABLE co2routex_jobs
          ADD CONSTRAINT chk_co2routex_jobs_status
          CHECK (status IN ('queued','running','completed','failed'));
    END IF;
END$$;

COMMENT ON TABLE co2routex_jobs IS 'CO2RouteX stage runs per model';
COMMENT ON COLUMN co2routex_jobs.job_id IS 'Upstream job identifier';
COMMENT ON COLUMN co2routex_jobs.stage IS 'connections, routing or costs stage';
COMMENT ON COLUMN co2routex_jobs.outputs IS 'Produced files with sizes';

COMMIT;
