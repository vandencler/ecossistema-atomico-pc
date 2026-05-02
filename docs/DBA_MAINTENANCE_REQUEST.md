# DBA Request: Ecosystem & Mirror Database Maintenance (REVISED)

**Project:** Ecossistema Atômico de Vendas (EAV)
**Priority:** CRITICAL (Scale-up Blocker)
**Target Host:** `192.168.2.163`
**Target Databases:** `ECOSSISTEMA_ATOMICO`, `ALTERDATA_SHOP_ESPELHO`
**Date:** 2026-05-01

## 1. Context
Following the Phase 6 rollout to 50 sales representatives, severe performance bottlenecks (~800ms per lookup) and "Permission Denied" errors were identified. This request consolidates all required database actions to ensure platform stability.

## 🔴 CEO DIRECTIVE (2026-05-01)
This request is a **HARD BLOCKER** for the Pilot Phase. Execution on `192.168.2.163` is required by Monday morning. The target for customer lookups is **<100ms**.

## 2. Actions for Ecosystem DB (`ECOSSISTEMA_ATOMICO`)
Required for multi-manager SAV workflow.

```sql
-- Add audit column for SAV locking mechanism
ALTER TABLE acoes_pendentes ADD COLUMN IF NOT EXISTS revisando_por VARCHAR(64);
```

## 3. Actions for Mirror DB (`ALTERDATA_SHOP_ESPELHO`)
Required for performance and sync integrity.

### 3.1. Indexing
```sql
-- Search Optimization (Trigram)
CREATE INDEX IF NOT EXISTS idx_pessoas_cdchamada_trgm ON wshop.pessoas USING gin (cdchamada gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_telwa_trgm ON wshop.pessoas USING gin (REGEXP_REPLACE(COALESCE(campostelwhatsapp,''), '[^0-9]', '', 'g') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pessoas_phone_trgm ON wshop.pessoas USING gin (REGEXP_REPLACE(COALESCE(nrtelefone,''), '[^0-9]', '', 'g') gin_trgm_ops);

-- Dashboard/History Optimization
CREATE INDEX IF NOT EXISTS idx_docitem_idpessoa ON wshop.docitem (idpessoa);
CREATE INDEX IF NOT EXISTS idx_docitem_idproduto ON wshop.docitem (idproduto);

-- Statistics
ANALYZE wshop.pessoas;
ANALYZE wshop.docitem;
```

### 3.2. Permission Hardening (CRITICAL)
The application is failing with `permission denied` on multiple lookup tables for the `eav_writer` and `eav_reader` roles.

```sql
-- Ensure usage on schema
GRANT USAGE ON SCHEMA wshop TO eav_writer, eav_reader;

-- Grant SELECT on ALL required tables to BOTH roles
GRANT SELECT ON 
    wshop.pessoas, 
    wshop.crediar, 
    wshop.docitem, 
    wshop.documen, 
    wshop.produto, 
    wshop.tabelaprecos, 
    wshop.pessoas_endereco, 
    wshop.documento_nfce, 
    wshop.movcaix, 
    wshop.tprec, 
    wshop.grupo 
TO eav_writer, eav_reader;

-- Grant UPDATE on sync targets (SAV Workflow) ONLY to eav_writer
GRANT UPDATE ON wshop.pessoas TO eav_writer;
GRANT UPDATE ON wshop.crediar TO eav_writer;
```

## 4. Verification
- `SELECT COUNT(*) FROM wshop.tabelaprecos` should work for both `eav_writer` and `eav_reader`.
- `\d wshop.docitem` should show the new `idpessoa` index.
- `SHOW max_connections` should ideally return **250** (as per EAV-94).

---
*Signed: CEO, Ecossistema Atômico*
*Technical Audit by CTO (EAV)*
