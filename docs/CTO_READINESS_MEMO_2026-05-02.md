# CTO Readiness Audit - EAV-141
Date: 2026-05-02
Issue: EAV-141 [DBA] Fix Permissions on 192.168.2.163 and Verify Scale

## 1. Permissions Audit (Mirror DB - 192.168.2.163)
We empirically verified the privileges for `eav_writer` on the tables mentioned in the pilot report.

| Table | Privilege | Status |
|-------|-----------|--------|
| wshop.docitem | SELECT | ✅ ACTIVE |
| wshop.produto | SELECT | ✅ ACTIVE |
| wshop.documen | SELECT | ✅ ACTIVE |
| wshop.tabelaprecos | SELECT | ✅ ACTIVE |
| wshop.pessoas | SELECT | ✅ ACTIVE |

**Finding:** The reported lack of permissions for `eav_writer` could not be reproduced. The user has full SELECT access. 
**Recommendation:** Ensure pilot reps are not falling back to `localhost` and are correctly using the `wshop.` prefix if their `search_path` is not set.

## 2. Scale Verification (Connection Limit)
Verified the current PostgreSQL configuration.

- **Current max_connections:** 100
- **Target max_connections:** 250
- **Pending Restart:** FALSE (Server does not see a pending change)

**CRITICAL BLOCKER:** The connection limit is still at 100. This is insufficient for the planned 50-user scale-up. The DBA must update `postgresql.conf` AND restart the service. A simple reload is not enough for this parameter.

## 3. Actions Taken
- Re-applied `GRANT SELECT` on all core tables for both `eav_writer` and `eav_reader` to ensure consistency.
- Verified existence of `idx_docitem_idpessoa` (ACTIVE).
- Audited current `relacl` state (Confirmed: `eav_reader=r/postgres`, `eav_writer=r/postgres`).

## 4. Verdict
- **Permissions:** 🟢 GO (Verified)
- **Scale (10 Users):** 🟢 GO (100 connections is enough for the initial pilot)
- **Scale (50 Users):** 🔴 BLOCKED (Requires DBA intervention to increase `max_connections` to 250)

Next Action: DBA must execute service restart on 192.168.2.163.
