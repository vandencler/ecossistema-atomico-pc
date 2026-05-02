-- Migration 008: Add pitch to affinity cache
ALTER TABLE ml_product_affinity ADD COLUMN pitch TEXT;
