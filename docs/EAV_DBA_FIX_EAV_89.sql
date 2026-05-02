-- =============================================================================
-- EAV DBA FIX: EAV-89 Performance Optimization
-- Task: EAV-95 / EAV-89
-- Target Host: 192.168.2.163
-- Target DB: ALTERDATA_SHOP_ESPELHO
-- Date: 2026-05-01
-- =============================================================================

-- 1. Increase max_connections to 250
-- Note: This requires a restart of the PostgreSQL service.
ALTER SYSTEM SET max_connections = '250';

-- 2. Create Index for Product Affinity & Recommendations
-- Targeting wshop.docitem (idproduto)
CREATE INDEX IF NOT EXISTS idx_docitem_idproduto ON wshop.docitem (idproduto);

-- 3. Create Index for Customer Purchase History
-- Targeting wshop.docitem (idpessoa)
CREATE INDEX IF NOT EXISTS idx_docitem_idpessoa ON wshop.docitem (idpessoa);

-- 4. Refresh Statistics
ANALYZE wshop.docitem;

-- =============================================================================
-- VERIFICATION QUERIES:
-- SHOW max_connections;
-- SELECT * FROM pg_indexes WHERE tablename = 'docitem';
-- =============================================================================
