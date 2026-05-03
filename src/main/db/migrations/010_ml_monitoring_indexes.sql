-- Migration 009: ML Monitoring Indexes
-- Optimizes health checks and freshness audits for ML tables

CREATE INDEX IF NOT EXISTS idx_ml_churn_risk_freshness ON ml_churn_risk(calculado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ml_product_affinity_freshness ON ml_product_affinity(calculado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ml_client_sentiment_freshness ON ml_client_sentiment(calculado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ml_client_profiles_freshness ON ml_client_profiles(calculado_em DESC);
