-- =============================================================================
-- EAV DBA OPTIMIZATION: EAV-167 Optimize SAV Queue Performance
-- Task: EAV-167
-- Target Host: 192.168.2.163
-- Target DB: ECOSSISTEMA_ATOMICO
-- Date: 2026-05-10
-- =============================================================================

-- 1. Create a Covering Index for the SAV Queue
-- This index optimizes the main queue listing (getActionQueue) 
-- and the high-frequency navigational alerts (getNavigationAlerts).
-- It covers the most common filters (status) and ordering (criado_em DESC).
-- Given PostgreSQL 9.6, we include small functional columns in the key.

CREATE INDEX IF NOT EXISTS idx_acoes_pendentes_covering_queue 
ON acoes_pendentes (status, criado_em DESC, tipo_acao, origem, campo, entidade);

-- 2. Expression Index for the complex CASE ordering
-- This specifically targets the custom sort logic used in savService.js
-- to ensure O(1) sort performance even for the "View All" status.

CREATE INDEX IF NOT EXISTS idx_acoes_pendentes_ordered_logic
ON acoes_pendentes (
  (CASE status 
    WHEN 'PENDENTE' THEN 1 
    WHEN 'APROVADO' THEN 2 
    WHEN 'ERRO' THEN 3 
    WHEN 'REJEITADO' THEN 4 
    WHEN 'CONCLUIDO' THEN 5 
    ELSE 9 
  END), 
  criado_em DESC
);

-- 3. Refresh Statistics
ANALYZE acoes_pendentes;

-- =============================================================================
-- VERIFICATION:
-- EXPLAIN ANALYZE SELECT ... FROM acoes_pendentes WHERE status = 'PENDENTE' ORDER BY criado_em DESC;
-- =============================================================================
