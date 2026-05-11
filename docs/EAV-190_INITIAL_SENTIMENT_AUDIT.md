# EAV-190 Initial Sentiment Audit (Wave 1 NPS Feedback)

**Date:** 2026-05-10
**Responsible:** CMO (Gemini CLI)
**Status:** COMPLETE

## 1. Executive Summary
The initial sentiment audit for the Phase 6 Pilot (Wave 1) shows a highly positive reception of the Ecossistema Atômico de Vendas. With a current NPS of **68.18** and zero real detractors, the platform has established a strong foundation for the Wave 2 expansion to 50 users.

## 2. Key Metrics
*   **Net Promoter Score (NPS):** 68.18
*   **Average Rating:** 9.25 / 10
*   **Total Responses:** 22
*   🟢 **Promoters (9-10):** 15 (68.18%)
*   🟡 **Neutrals (7-8):** 7 (31.82%)
*   🔴 **Detractors (0-6):** 0 (0%)

## 3. Detailed Analysis
### 3.1. Data Hygiene & Verification
*   An earlier report of 2 detractors was investigated. Both accounts (`usuario@DESKTOP-9HCET0A` and `TEST_USER_UI`) were confirmed as internal test sessions and have been purged from the sentiment baseline.
*   A data gap for the 10 original Power Users was identified (ID mismatch). A manual NPS survey was triggered today (Sunday, 10/05) for the 8 users with valid phone numbers to ensure complete coverage.

### 3.2. Feedback Themes
*   **Speed & Efficiency:** Users highly praise the "Atomic Search" and the general responsiveness of the interface compared to the legacy ERP modules.
*   **Offline Resilience:** Positive feedback regarding the platform's stability during intermittent network issues.
*   **Sidebar Friction (EAV-134):** The intermittent sidebar visibility issue is the only recurring point of minor frustration. It has been proactively addressed in the Wave 2 onboarding materials with a "Logo Click" recovery tip.

## 4. Wave 2 Readiness (50 Users)
*   **Onboarding:** All 50 users (11 Power Users + 39 Additional) were successfully onboarded via WhatsApp today.
*   **Training Dispatch:** "Guia do Multiplicador" and "Pílulas de Conhecimento" are ready for the week's rollout.
*   **Engagement:** Telemetry shows >64,000 events, indicating very high active usage from the pilot group.

## 5. Recommended Actions
1.  **Monitor Inbound (Monday 09:00 AM):** Audit the responses from the manual survey sent to the 10 Power Users.
2.  **Sentiment Pulse:** Continue weekly audits of `v_sentimento_feedback` to detect any drop in NPS as the user base expands.
3.  **UI Polish:** Prioritize the permanent fix for the Sidebar Bug (EAV-134) to convert the 7 neutrals into promoters.

---
*Verified and Signed,*
**CMO (Gemini CLI)**
