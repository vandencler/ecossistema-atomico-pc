# DBA Request: Mirror Database Optimization (REVISED)

**Project:** Ecossistema Atômico de Vendas (EAV)
**Priority:** CRITICAL (Pilot Phase Blocker)
**Target Host:** `192.168.2.163`
**Target Database:** `ALTERDATA_SHOP_ESPELHO`
**Date:** 2026-05-01

## 1. Context
The EAV platform utilizes PostgreSQL Trigram Search (`pg_trgm`) to provide high-performance fuzzy searching for the sales team. Currently, only a subset of required indexes is active. To enable ultra-fast searching and resolve the ~867ms latency bottleneck, the following optimizations must be applied.

## 2. Required SQL Execution
Please execute the following commands as a superuser or the owner of the `wshop` schema.

```sql
-- 1. Ensure extension is present
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Permission Grant (Critical for Lookup Service)
GRANT SELECT ON wshop.pessoas TO eav_reader;

-- 3. Full Trigram Optimization (6 Indexes)
-- nmpessoa: fuzzy search for full names
CREATE INDEX IF NOT EXISTS idx_pessoas_nmpessoa_trgm ON wshop.pessoas USING gin (LOWER(nmpessoa) gin_trgm_ops);

-- nmcurto: fuzzy search for nicknames/short names
CREATE INDEX IF NOT EXISTS idx_pessoas_nmcurto_trgm ON wshop.pessoas USING gin (LOWER(nmcurto) gin_trgm_ops);

-- cdchamada: fuzzy search for call codes/IDs
CREATE INDEX IF NOT EXISTS idx_pessoas_cdchamada_trgm ON wshop.pessoas USING gin (LOWER(cdchamada) gin_trgm_ops);

-- nrcgc_cic: trigram search for documents (CPF/CNPJ)
CREATE INDEX IF NOT EXISTS idx_pessoas_nrcgc_cic_trgm ON wshop.pessoas USING gin (LOWER(nrcgc_cic) gin_trgm_ops);

-- Optimized Phone Search (Split into separate indexes for better OR performance)
-- We use a functional index to search only the digits, matching the application's search logic.
CREATE INDEX IF NOT EXISTS idx_pessoas_telwa_trgm ON wshop.pessoas USING gin (
    REGEXP_REPLACE(COALESCE(campostelwhatsapp,''), '[^0-9]', '', 'g') gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS idx_pessoas_phone_trgm ON wshop.pessoas USING gin (
    REGEXP_REPLACE(COALESCE(nrtelefone,''), '[^0-9]', '', 'g') gin_trgm_ops
);

-- 4. Re-analyze statistics
ANALYZE wshop.pessoas;

-- 5. Permission Hardening (Required for Pilot Sync)
-- The application requires SELECT on people/credit for dashboarding
-- and UPDATE for the real-time sync service.
GRANT USAGE ON SCHEMA wshop TO eav_writer;
GRANT USAGE ON SCHEMA wshop TO eav_reader;

GRANT SELECT, UPDATE ON wshop.pessoas TO eav_writer;
GRANT SELECT, UPDATE ON wshop.crediar TO eav_writer;

GRANT SELECT ON wshop.pessoas TO eav_reader;
GRANT SELECT ON wshop.crediar TO eav_reader;
```

## 3. Verification
After execution, the EAV Health Dashboard will automatically detect these indexes (specifically looking for `idx_pessoas_telwa_trgm` or the legacy `idx_pessoas_phones_trgm` which this replaces). Target latency for customer lookups is **<100ms**.

## 🔴 CEO DIRECTIVE (2026-05-01)
This request is a **HARD BLOCKER** for the Pilot Phase. Execution on `192.168.2.163` is required by Monday morning.

---
*Signed: CEO, Ecossistema Atômico*
*Technical Audit by CTO (EAV)*
