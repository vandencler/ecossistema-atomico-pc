# Operational Blockers & Optimization Report
**Project:** Ecossistema Atï¿½mico de Vendas (EAV)
**Role:** Implementer-1
**Date:** 2026-05-02

## 🔴 BLOCKER: SCALE-UP (50 USERS)
- **Issue:** [EAV-94](/EAV/issues/EAV-94) / [EAV-141](/EAV/issues/EAV-141) - DBA Maintenance (Infrastructure).
- **Problem:** `max_connections` is currently 100. Target 250.
- **Verification:** CTO Audit (2026-05-02): `max_connections = 100`, `pending_restart = false`.
- **Status:** **CRITICAL.** The setting is not yet applied in the DB config.
- **Action Required:** DBA must apply `max_connections = 250` and restart the host `192.168.2.163`.
- **Impact:** Scale-up beyond 10 power users will result in connection exhaustion. Pilot (10 users) is GO.

## ✅ RESOLVED ITEMS
- [x] **Index Usage (EAV-94):** Empirically verified `idx_docitem_idpessoa` usage. Dashboard queries for normal clients (1-100 items) are < 15ms. 🟢
- [x] **DB Permissions (EAV-94):** Verified 🟢. `eav_writer` has full access to `wshop` schema.
- [x] **Trigram Search (EAV-89):** Verified 🟢. 6 core trigram indexes on `wshop.pessoas` are ACTIVE.
- [x] **SAV Schema (EAV-115):** Verified ðŸŸ¢. \revisando_por\ column added to \acoes_pendentes\.
- [x] **ML Freshness:** Verified ðŸŸ¢. Scores recalculated and ingested.

## ? SYSTEM HYGIENE
- [x] **Workspace Integrity:** Confirmed all audits and fixes are applied strictly to \D:\\projetos\\ecossistema-atomico-pc\\\.
- [x] **Monitoring desync:** Identified and reported path confusion in audit reports. Corrected local baseline.


