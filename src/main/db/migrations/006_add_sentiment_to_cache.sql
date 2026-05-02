-- Migration 006: Add Sentiment to Cache
CREATE TABLE IF NOT EXISTS ml_client_sentiment (
  idpessoa TEXT PRIMARY KEY,
  sentiment_score REAL,
  sentiment_label TEXT,
  last_message_at TEXT,
  calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
