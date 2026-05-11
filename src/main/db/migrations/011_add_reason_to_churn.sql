-- Migration 011: Add Reason to Churn Risk
ALTER TABLE ml_churn_risk ADD COLUMN IF NOT EXISTS reason_code VARCHAR(100);
ALTER TABLE ml_churn_risk ADD COLUMN IF NOT EXISTS reason_detail TEXT;
