-- Migration 003: Add Phone Numbers to Client Cache
-- This enables offline search by phone number.

ALTER TABLE client_cache ADD COLUMN nrtelefone TEXT;
ALTER TABLE client_cache ADD COLUMN campostelwhatsapp TEXT;

-- Index for phone search in SQLite
CREATE INDEX IF NOT EXISTS idx_client_cache_phones ON client_cache(nrtelefone, campostelwhatsapp);
