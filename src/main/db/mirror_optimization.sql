-- Ecossistema Atômico: Mirror Database Optimization
-- These indexes are critical for high-performance searching on the Alterdata Shop Mirror.
-- Run these as a superuser or the owner of the 'wshop' schema on the Mirror database.

-- Ensure pg_trgm extension is available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Pessoas table optimizations
-- nmpessoa: fuzzy search for full names
CREATE INDEX IF NOT EXISTS idx_pessoas_nmpessoa_trgm ON wshop.pessoas USING gin (LOWER(nmpessoa) gin_trgm_ops);

-- nmcurto: fuzzy search for nicknames/short names
CREATE INDEX IF NOT EXISTS idx_pessoas_nmcurto_trgm ON wshop.pessoas USING gin (LOWER(nmcurto) gin_trgm_ops);

-- cdchamada: fuzzy search for call codes/IDs
CREATE INDEX IF NOT EXISTS idx_pessoas_cdchamada_trgm ON wshop.pessoas USING gin (LOWER(cdchamada) gin_trgm_ops);

-- nrcgc_cic: trigram search for documents (CPF/CNPJ) allowing partial matches
CREATE INDEX IF NOT EXISTS idx_pessoas_nrcgc_cic_trgm ON wshop.pessoas USING gin (LOWER(nrcgc_cic) gin_trgm_ops);

-- nrtelefone: search for sanitized numbers (digits only)
CREATE INDEX IF NOT EXISTS idx_pessoas_phones_trgm ON wshop.pessoas USING gin (
    REGEXP_REPLACE(COALESCE(campostelwhatsapp,''), '[^0-9]', '', 'g') gin_trgm_ops,
    REGEXP_REPLACE(COALESCE(nrtelefone,''), '[^0-9]', '', 'g') gin_trgm_ops
);

-- Analyze to update statistics
ANALYZE wshop.pessoas;
