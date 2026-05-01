const { ecoPool } = require('../src/main/db');

async function run() {
  const sql = `
-- Table for telemetry and usage metrics
CREATE TABLE IF NOT EXISTS telemetry_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    payload JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_name ON telemetry_events(event_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_occurred_at ON telemetry_events(occurred_at);

-- ML Integration Schema (Phase 2)
CREATE TABLE IF NOT EXISTS ml_churn_risk (
    idpessoa VARCHAR(40) PRIMARY KEY,
    risk_score DECIMAL(5,2) DEFAULT 0.00,
    next_purchase_estimate DATE,
    confidence DECIMAL(5,2) DEFAULT 0.00,
    model_version VARCHAR(50),
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ml_product_affinity (
    id SERIAL PRIMARY KEY,
    idpessoa VARCHAR(40) NOT NULL,
    idproduto VARCHAR(40) NOT NULL,
    affinity_score DECIMAL(5,2) DEFAULT 0.00,
    reason_code VARCHAR(50),
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idpessoa, idproduto)
);

CREATE INDEX IF NOT EXISTS idx_ml_affinity_pessoa ON ml_product_affinity(idpessoa);
CREATE INDEX IF NOT EXISTS idx_ml_affinity_score ON ml_product_affinity(affinity_score DESC);

-- Trigger for Real-Time SAV Sync (9.6 compatible)
CREATE OR REPLACE FUNCTION notify_sav_approved()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'APROVADO' AND OLD.status != 'APROVADO' THEN
    PERFORM pg_notify('sav_approved', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_sav_approved ON acoes_pendentes;
CREATE TRIGGER trg_notify_sav_approved
AFTER UPDATE OF status ON acoes_pendentes
FOR EACH ROW
EXECUTE PROCEDURE notify_sav_approved();
  `;

  try {
    await ecoPool.query(sql);
    console.log('Missing tables created successfully.');
  } catch (e) {
    console.error('Error creating tables:', e);
  } finally {
    process.exit(0);
  }
}

run();
