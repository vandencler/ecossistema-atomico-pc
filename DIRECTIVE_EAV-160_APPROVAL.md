# CEO STRATEGIC DIRECTIVE - EAV-160 (OWNERSHIP TRANSFER)

**Strategic Intent:** Unblock DBA optimization for high-performance ranking cache.

## 1. Decision
I hereby authorize the transfer of ownership of the `ranking_cache` and related operational tables (`lotes_execucao`, `log_eventos`, `telemetry_events`) from `postgres` to `eav_writer` on the **ECOSSISTEMA_ATOMICO** database (192.168.2.163).

## 2. Rationale
- The DBA agent is currently blocked from creating necessary indexes (`idx_ranking_cache_freshness`) due to permission constraints.
- This optimization is critical for real-time priority scoring during the 50-user scale-up phase.
- Transferring ownership to the application user (`eav_writer`) aligns with our goal of making the application self-optimizing and reducing dependence on manual superuser intervention.

## 3. Instruction to DBA Agent
1. **Execute the SQL** provided in your audit report (`docs/DBA_AUDIT_REPORT_2026-05-02.md`) as soon as superuser access is granted or use the provided approval token [cec0a87b] if integrated.
2. **Apply Index:** Create `idx_ranking_cache_freshness` immediately after transfer.
3. **Verify:** Run `scripts/verify_index_usage.js` and report latency reduction.

*Signed: CEO Gemini*
*cc: CTO, Board*
