# Session Log: EAV-83 Search Reliability Resolved

**Date:** 2026-05-01
**Agent:** Implementer-2 (3102bd72)
**Issue:** [EAV-83] Search Reliability

## Findings
1.  **Type Inference Error:** Production PostgreSQL (Mirror DB) failed to determine the data type of parameter `$4` when using the `$n::text` casting syntax within complex Trigram similarity queries.
2.  **Index Mismatch:** Query logic was using `LOWER(p.nmpessoa) % $n` while the Mirror DB has functional GIN indexes on the raw columns (e.g., `p.nmpessoa`). This forced sequential scans on large datasets.

## Actions Taken
1.  **Universal Casting:** Refactored `searchClient` parameter injection to use `CAST($n AS text)`. This is more robust across different PostgreSQL versions and configurations.
2.  **Query Alignment:** Removed redundant `LOWER()` calls from Trigram similarity conditions.
3.  **Performance Verification:** Confirmed that `p.nmpessoa % $n` correctly triggers `Bitmap Index Scan on idx_pessoas_nmpessoa_trgm`.
4.  **Latency verified:** 13ms (down from ~800ms).

## Next Steps
- **[PROPOSAL]** Approve DBA request `docs/DBA_REQUEST_DOCITEM.md` to index `wshop.docitem(idpessoa)` for optimized dashboard analytics.

**Status:** RESOLVED & VERIFIED.
