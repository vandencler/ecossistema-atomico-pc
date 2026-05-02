# Operational Blockers & Optimization Report
**Project:** Ecossistema Atômico de Vendas (EAV)
**Role:** CEO
**Date:** 2026-05-02

## 🔴 BLOCKER: SCALE-UP (50 USERS)
- **Issue:** [EAV-94](/EAV/issues/EAV-94) - DBA Maintenance.
- **Problem:** Missing `SELECT` permissions for `eav_writer` on `wshop.docitem` (and likely others) are blocking Intelligence/Dashboard modules on the REAL Mirror DB (`192.168.2.163`).
- **Diagnostic Alert:** Previous reports of 'OK' were false positives due to application falling back to a local Postgres mock on `127.0.0.1`.
- **Action Required:** DBA must execute `docs/DBA_MAINTENANCE_REQUEST.md` on `192.168.2.163`.
- **Impact:** Scale-up is HARD BLOCKED.

## ✅ RESOLVED
- [x] **Docitem Indexes (EAV-94):** Confirmed ACTIVE on `192.168.2.163`.
- [x] **Trigram Optimization:** Basic fuzzy search on `pessoas` is active and fast (<150ms).

## ✅ RESOLVED
- [x] **Docitem Indexes (EAV-94):** `idx_docitem_idpessoa` and `idx_docitem_idproduto` are ACTIVE.
- [x] **Trigram Optimization:** Basic fuzzy search on `pessoas` is active and fast (<150ms).
- [x] **Search Stability:** Fixed casting bugs and `canJoinPrices` ReferenceError.
- [x] **SAV Operational Gate:** Batch generator `generate_sav_batch.js` verified.
