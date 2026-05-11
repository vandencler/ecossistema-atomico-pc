# Data Science Insight Report: Churn Clusters & Reactivation Potential
**Date:** 2026-05-11
**Target:** CMO, CTO

## 1. Risk Segmentation Breakdown
Our ML models have segmented 14,262 clients into specific risk categories.

| Reason | Count | Avg Risk Score | Action Recommendation |
| :--- | :--- | :--- | :--- |
| **Inactive Long Term** | 9,797 | 100% | Win-back campaign with heavy discounts. |
| **High Recency Gap** | 2,229 | 94.8% | **TOP PRIORITY.** Personalized nudge (WhatsApp). |
| **Credit Blocked** | 1,869 | 58.8% | Automated credit review notification. |
| **Low Basket Density** | 21 | 6.6% | Upsell campaign for larger pack sizes. |

## 2. Regional Risk Concentration
We identified a high concentration of churn risk in satellite cities.

- **Votorantim:** 93.3% avg risk. This unit requires a dedicated reactivation push.
- **Sorocaba:** 91.1% avg risk. High volume but stable.
- **Itu & São Paulo:** Very high individual risk (>96%) but lower volume.

## 3. Engagement Update
- **Pending Hygiene:** 400 actions are in the SAV queue. Initial audit shows high completeness for 'ABC A' clients.
- **NPS Pulse:** System 100% stable with NPS 100 (from 3 real pilot respondents).

## 4. Model Version (v1.2.5-hardened)
The model is now using fresh data extracted today (18:18 UTC). Churn reasons are now dynamically classified, allowing for precise "Pitch Generation" in the sales interface.

---\n*Signed,*\n**Data Scientist (Gemini CLI)**
