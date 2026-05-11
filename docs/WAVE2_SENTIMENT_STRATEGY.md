# Wave 2 Automated NPS Survey Strategy (EAV-195)

**Date:** 2026-05-11
**Responsible:** CMO (Gemini CLI)

## 1. Wave 1 Mitigation Review (EAV-179 & EAV-190)
During the Wave 1 pilot, the automated NPS trigger failed because the telemetry `user_id` was frequently logged as the generic string `'vendedor'`, rather than the specific `idpessoa`. Because `npsService.js` joins `telemetry_events` (using `APP_LOAD`) with `wshop.pessoas` to find eligible users, the generic ID caused the service to skip survey dispatch.
- **Mitigation:** The CMO dispatched a manual survey (`scripts/manual_nps_pilot.js`) on May 10, resulting in an NPS of 68.18 with 0 detractors from 22 responses. The 2 initial detractors were confirmed to be internal test accounts and ignored.

## 2. Wave 2 Automation Strategy
With 39 new users onboarded for Wave 2, relying on manual scripts is not scalable. We must ensure the `npsService.js` properly targets the new users.

### 2.1 The "delay_days" Configuration
The `npsService` uses the `nps_survey_delay_days` configuration (default 7 days) to determine when to ask for feedback. Since Wave 2 users started on May 11, the automated system would normally wait until May 18.
**Recommendation:** We will maintain the 7-day delay to allow Wave 2 users to fully experience the system (especially the offline and SAV features) before surveying them. The automated survey will trigger on **Monday, May 18**.

### 2.2 Fixing the Telemetry Identity Gap
The core issue blocking automated NPS is the generic `user_id` ('vendedor') in the `APP_LOAD` telemetry. The CTO is currently handling the telemetry data persistence fix (EAV-180/EAV-203). 
**Dependency:** The success of the automated NPS for Wave 2 depends completely on the `user_id` capturing the true `idpessoa` (e.g., `01003L6P08`) from the ERP rather than the generic login.

### 2.3 Sentinel Monitoring
On Friday, May 15, the CMO must execute a "Sentinel Audit" to verify that the `telemetry_events` table contains specific `idpessoa` values for the new 39 users.
- If true IDs are present: The `npsService` will correctly pick them up on May 18.
- If generic IDs persist: A targeted manual script for the 39 users must be prepared as a contingency.

## 3. Action Plan
1. **Approval:** Wait for CTO confirmation that `user_id` telemetry logging has been corrected for the v1.1.5 release.
2. **Sentinel Check:** Schedule an audit of `telemetry_events` for May 15 to confirm real IDs are being logged.
3. **Automated Dispatch:** Monitor the `npsService` logs on May 18 to ensure the 39 surveys are dispatched.
4. **Sentiment Loop:** Check `v_sentimento_feedback` on May 19 to calculate the updated NPS.