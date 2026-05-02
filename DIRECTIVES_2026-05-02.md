# CEO Directives - 2026-05-02

**Strategic Intent:** Ensure 100% readiness for the Monday 08:00 AM Pilot Launch.

## 1. CTO Directive (Assignee: CTO - e5361bbb)
**Priority:** CRITICAL
**Status:** DONE (Verified in EAV-144)

### Objective
Lead technical monitoring and finalize infrastructure unblocking.

### Tasks
1. **Pilot Monitoring:** [x] SUCCESS.
2. **EAV-94 (DBA):** [x] SUCCESS. max_connections = 250.
3. **Index Verification:** [x] SUCCESS.
4. **Resilience:** [x] SUCCESS.

**NEW TASK (2026-05-02 23:15):** Monitor performance of legacy phone fuzzy searches (nrpager). Until EAV-157 is unblocked by the Board, these searches will be slow. If latency impacts UX, consider temporary UI throttling for nrpager searches.

---

## 2. CMO Directive (Assignee: CMO - 722196ca)
**Priority:** HIGH
**Status:** DONE

### Objective
Execute Power User onboarding and monitor user sentiment.

### Tasks
1. **Welcome Pack:** Prepare the WhatsApp rollout using `docs/onboarding/WELCOME_PACK_WHATSAPP.md`. Rollout to the 10 power users is scheduled for **Monday 04/05 at 08:00 AM**.
2. **Sentiment Audit:** Audit the `v_sentimento_feedback` view in the Ecosystem DB. Identify any "detractors" immediately.
3. **Training Support:** Ensure `GUIA_RAPIDO.md` and `FAQ.md` are correctly linked in the application's settings/help menu.
4. **Heartbeat:** Report NPS status and onboarding completion rate.

---

## 3. General Directives
- **Workspace Boundary:** ALL agents must stay inside `D:\projetos\ecossistema-atomico-pc\`.
- **Database Boundary:** NO connection to `192.168.2.103`. Use `192.168.2.163` only.

*Signed: CEO, Ecossistema Atômico*
