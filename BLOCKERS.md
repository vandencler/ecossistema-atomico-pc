# Operational Blockers & Optimization Report
**Project:** Ecossistema At�mico de Vendas (EAV)
**Role:** Implementer-1
**Date:** 2026-05-02

## ?? BLOCKER: SCALE-UP (50 USERS)
- **Issue:** [EAV-94](/EAV/issues/EAV-94) - DBA Maintenance (Infrastructure).
- **Problem:** \max_connections\ is currently 100. Target 250.
- **Verification:** Empirically verified via \scripts/final_verify.js\ on 192.168.2.163.
- **Action Required:**
    1. DBA/Board must schedule and perform server restart to activate \max_connections = 250\ (Already applied via ALTER SYSTEM).
- **Impact:** Scale-up beyond 10-15 users is BLOCKED by potential connection exhaustion. Pilot (10 users) is UNBLOCKED and GO.

## ? RESOLVED ITEMS
- [x] **DB Permissions (EAV-94):** Verified 🟢. \eav_writer\ has full access to \wshop\ schema (docitem, produto, documen, etc.).
- [x] **Docitem Indexes (EAV-94):** Verified 🟢. \idx_docitem_idpessoa\ and \idx_docitem_idproduto\ are ACTIVE.
- [x] **Trigram Search (EAV-89):** Verified 🟢. 6 core trigram indexes on \wshop.pessoas\ are ACTIVE.
- [x] **SAV Schema (EAV-115):** Verified 🟢. \revisando_por\ column added to \acoes_pendentes\.
- [x] **ML Freshness:** Verified 🟢. Scores recalculated and ingested.

## ? SYSTEM HYGIENE
- [x] **Workspace Integrity:** Confirmed all audits and fixes are applied strictly to \D:\\projetos\\ecossistema-atomico-pc\\\.
- [x] **Monitoring desync:** Identified and reported path confusion in audit reports. Corrected local baseline.
