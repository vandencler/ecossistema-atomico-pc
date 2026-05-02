# 📅 Monday Rollout Plan: Phase 6 Pilot (CMO)
**Date:** Monday, May 4th, 2026
**Owner:** CMO Gemini
**Goal:** 100% Onboarding of the 10 Power Users and <200ms Search Satisfaction.

## 🕒 Schedule (São Paulo Time)

### 07:30 - Pre-Flight Check
- Run `node scripts/monitor_pilot.js` to ensure DBs are up.
- Verify `config.local.json` points to `192.168.2.163`.
- Check `log_eventos` for any critical errors in the last 8h.

### 08:00 - Onboarding Kick-off
- **Message #1 (Welcome Pack):** Dispatch to the 10 Power Users.
- **Critical Action:** For the sellers identified without phones (e.g., STEFANY), trigger manual phone number collection via Unit Managers.
- **Verification:** Monitor `omnichannel_mensagens` for `SENT` status.

### 09:30 - Live Sentiment Audit
- Monitor `app_feedback` for "Sad" reports.
- If Sidebar Bug is reported: Respond immediately with the "Logo Click" tip.

### 11:00 - Knowledge Injection #1
- **Message:** "Pílula #1: A Busca Atômica 🔍"
- Focus: Speed and error tolerance.

### 14:00 - Mid-Day Report
- Run `node scripts/generate_sentiment_report.js`.
- Deliver status update to Board/CEO.

### 14:30 - Expansion Trigger (Wave 2 - 50 Users)
- **GO/NO-GO Decision:** 
  1. Check if DBA completed `EAV-94` (Restart for `max_connections >= 250`).
  2. Verify NPS from the morning group is > 70.
  3. Confirm `monitor_pilot.js` shows no performance degradation.
- **Action:** If GO, dispatch `ANUNCIO_EXPANSAO_50.md` to the internal communication channel and trigger the bulk WhatsApp Welcome Pack for the new 40 users.

### 15:30 - Knowledge Injection #2
- **Message:** "Pílula #2: O Poder do Offline ⚡"
- Focus: Resilience.

### 17:00 - End of Day Audit
- Run final `monitor_pilot.js`.
- Archive `SENTIMENT_REPORT_LATEST.md` for historical comparison.

## 🚨 Contingency Plan (War Room)

| Incident | Action |
|----------|--------|
| **Search is Slow (>1s)** | Check if `idx_docitem_idpessoa` is active. Contact DBA for `EAV-94` priority. |
| **Login Failed** | Verify Host `192.168.2.163` in `config.local.json`. |
| **Sidebar Disappears** | Instruct user to click the floating logo or Ctrl+R. |
| **Sync Failure** | Check `acoes_pendentes` status. If many `ERRO`, pause SAV and contact CTO. |

---
*Success Metric: NPS > 70 and 0 "Critical" bugs reported by Power Users.*
