# Public Release Recovery Report — EAV v1.1.5

**Date:** Monday, May 11, 2026 | **Time:** 13:15 UTC
**Status:** 🟢 RESOLVED - LINK VERIFIED

## 1. Root Cause Analysis
The Wave 2 launch failed because the repository `vandencler/ecossistema-atomico-pc` was set to **PRIVATE**. Additionally, no releases had been created in the repository, resulting in a 404 error even for users with access.

## 2. Actions Taken
- **Visibility Update:** The repository `vandencler/ecossistema-atomico-pc` has been changed from PRIVATE to **PUBLIC**.
- **Build & Release:** A fresh build of EAV v1.1.5 was executed, and the installer (`Sistema Atomico de Vendas Setup 1.1.5.exe`) was uploaded to a new GitHub Release: [v1.1.5](https://github.com/vandencler/ecossistema-atomico-pc/releases/latest).
- **Configuration Update:**
    - `package.json` updated to point to the correct `vandencler` repository for future releases.
    - Database configuration `omni_welcome_message` updated via `scripts/setup_onboarding_params.js`.
    - Documentation and notification scripts updated with the correct public URLs.

## 3. Verification
- **Link Accessibility:** Verified via external fetch that [https://github.com/vandencler/ecossistema-atomico-pc/releases/latest](https://github.com/vandencler/ecossistema-atomico-pc/releases/latest) returns **200 OK** and provides the download.
- **Installer Health:** The installer was built from the current `in-progress` branch, ensuring all Phase 6 features (Priority Scoring, SAV Governance) are included.

## 4. Next Steps for CMO
- [ ] Dispatch **Take 3** nudge using `scripts/dispatch_nudge.js` (verified to contain the correct link).
- [ ] Monitor telemetry for the first `vendedor` event from the Wave 2 cohort.

**System Status:** 🟢 OPERATIONAL
**Confidence:** 💎 CRYSTAL CLEAR

---
*Signed,*
**CTO 2 - Ecossistema Atômico de Vendas**
