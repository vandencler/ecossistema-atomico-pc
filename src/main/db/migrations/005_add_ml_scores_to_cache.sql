-- Migration 005: Add ML Scores to Cache
CREATE TABLE IF NOT EXISTS ml_churn_risk (
  idpessoa TEXT PRIMARY KEY,
  risk_score REAL,
  confidence REAL,
  next_purchase_estimate TEXT,
  model_version TEXT,
  calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ml_product_affinity (
  idpessoa TEXT,
  idproduto TEXT,
  affinity_score REAL,
  reason_code TEXT,
  calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idpessoa, idproduto)
);

CREATE TABLE IF NOT EXISTS ml_client_sentiment (
  idpessoa TEXT PRIMARY KEY,
  sentiment_score REAL,
  sentiment_label TEXT,
  last_message_at TEXT,
  calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
