-- Migration 006: Add Client Sentiment Table
CREATE TABLE IF NOT EXISTS ml_client_sentiment (
  idpessoa TEXT PRIMARY KEY,
  sentiment_score REAL,
  sentiment_label TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
