# Revenue Recovery - Sorocaba Credit Amnesty (EAV-164)
**Status:** 🟢 COMPLETED
**Date:** 2026-05-02

## Summary
Successfully integrated 182 Class-A priority clients from Sorocaba into the SAV queue for credit review.

## Actions Taken
1.  **Identification:** Queried `ml_client_profiles`, `ranking_cache`, and `ml_churn_risk` to identify exactly 182 clients in Sorocaba with:
    - Class A ranking.
    - Churn Risk >= 90%.
    - Credit Blocked = TRUE.
2.  **SAV Integration:** Created 182 `CREDIT_REVIEW` actions in the `acoes_pendentes` table.
3.  **Intelligence Sync:** Updated each action with personalized sales pitches extracted from `ml_data/campaigns/activation_sorocaba_enriched.csv`.
4.  **Priority Verification:**
    - Verified that these clients receive an intelligence score of **70** (High Priority), even with the credit block penalty.
    - Actions are visible in the SAV Queue under the "Alta" priority filter.

## Pilot Group Impact
- The 10 pilot reps will see these actions in the SAV Queue.
- By searching for "Amnesty" or "Class-A Recovery", they can immediately access this recovery batch.
- Dashboards will reflect these new high-priority opportunities.

## Next Steps
- [ ] Manager approval of the 182 `CREDIT_REVIEW` actions in the SAV Queue.
- [ ] Sellers to reach out to these clients using the provided pitches.
- [ ] Monitor unblocking rate and subsequent revenue recovery.
