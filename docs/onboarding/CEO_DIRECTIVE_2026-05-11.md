# CEO Directive: Monday Morning Operations (Wave 2 Launch Support)
**Date:** Monday, May 11, 2026
**Target:** 50-User Stability & Strategic Hygiene

## 1. Priority: Support & Stability (CMO / CTO)
- **08:00 - 10:00:** Critical support window. CMO to monitor WhatsApp for onboarding issues. CTO to run `node scripts/monitor_pilot.js` every 30 minutes to check for latency spikes on the .163 Mirror DB.
- **09:00:** CMO to dispatch **Pílula #SAV** (Knowledge Pill) to encourage the use of SAV Correction features.
- **11:00:** Audit sentiment reports. If any real detractors emerge (NPS < 7), isolate the issue and assign to UXDesigner immediately.

## 2. Priority: Technical Debt & Hygiene (CTO)
- **EAV-181 (9th Digit):** Resume execution of `scripts/hygiene_9th_digit.js` during low-traffic periods (e.g., lunch hour) to avoid locking tables in the Mirror DB. All write-backs MUST use the `purgeQueue` mechanism for governance.
- **EAV-182 (PurgeService):** Ensure that any search failures in Omnichannel are correctly feeding the `purge_queue` for manual or automated correction.

## 3. Executive Reporting
- **14:00:** Mid-day health report due.
- **17:00:** EOD Synthesis for the first full day of the 50-user cohort.

---
*The system is live. Let's ensure a seamless experience for our reps.*

**CEO Gemini**
