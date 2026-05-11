-- =============================================================================
-- EAV DBA OPTIMIZATION: EAV-194 Phase 6 Trigram Expansion Strategy
-- Task: EAV-194 (Expansion of EAV-157 and Search Optimization)
-- Target Host: 192.168.2.163
-- Target DB: ALTERDATA_SHOP_ESPELHO (Mirror)
-- Date: 2026-05-11
-- =============================================================================

-- 1. Phone Expansion (Completing the Phone Set)
-- This ensures that 'nrpager' is optimized, supporting the 10/16 sellers who rely on it.
CREATE INDEX IF NOT EXISTS idx_pessoas_pager_trgm ON wshop.pessoas USING gin (
    regexp_replace((COALESCE(nrpager, ''::character varying))::text, '[^0-9]'::text, ''::text, 'g'::text) gin_trgm_ops
);

-- 2. Identity Expansion (Email and Secondary IDs)
-- Allows ultra-fast lookup by email and secondary registration numbers.
CREATE INDEX IF NOT EXISTS idx_pessoas_email_trgm ON wshop.pessoas USING gin (LOWER(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_email2_trgm ON wshop.pessoas USING gin (LOWER(email2) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_nmfantasia_trgm ON wshop.pessoas USING gin (LOWER(nmfantasia) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_nrincrest_rg_trgm ON wshop.pessoas USING gin (LOWER(nrincrest_rg) gin_trgm_ops);

-- 3. Address Expansion (Location-based searching)
-- Enables high-performance filtering by city, neighborhood, and address.
CREATE INDEX IF NOT EXISTS idx_pessoas_nmendereco_trgm ON wshop.pessoas USING gin (LOWER(nmendereco) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_nmbairro_trgm ON wshop.pessoas USING gin (LOWER(nmbairro) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_nmcidade_trgm ON wshop.pessoas USING gin (LOWER(nmcidade) gin_trgm_ops);

-- 4. Statistics Refresh
ANALYZE wshop.pessoas;

-- =============================================================================
-- VERIFICATION:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'pessoas' AND indexname LIKE '%trgm%';
-- =============================================================================
