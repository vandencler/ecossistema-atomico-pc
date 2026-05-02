-- Migration 009: Add nrpager to Client Cache
-- This enables offline search and fallback for Pager/Cell numbers.

ALTER TABLE client_cache ADD COLUMN nrpager TEXT;

-- Index for pager search in SQLite
CREATE INDEX IF NOT EXISTS idx_client_cache_nrpager ON client_cache(nrpager);
