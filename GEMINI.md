# Ecossistema Atômico de Vendas (EAV) — Governance & Technical Standards

> **⚠️ EVERY AGENT MUST READ THIS FILE COMPLETELY BEFORE ANY ACTION.**
> **Violation of these rules will result in IMMEDIATE TERMINATION of the agent.**

---

## 🚨 MANDATORY SECURITY BOUNDARIES

### INCIDENT REFERENCE
On 2026-04-30, agents edited the WRONG project folder and were shut down by the Board.
See: `D:\obsidian\memoria-infinita\memoria-infinita\Antigravity\sessoes\2026-04-30 INCIDENTE Paperclip editou pasta principal EAV.md`

### Filesystem Boundaries — ABSOLUTE AND NON-NEGOTIABLE

| Path | Permission | Description |
|------|-----------|-------------|
| `D:\projetos\ecossistema-atomico-pc\` | ✅ **YOUR WORKSPACE** | Edit freely HERE and ONLY here |
| `D:\projetos\ecossistema-atomico\` | ❌ **FORBIDDEN** | Antigravity's project. DO NOT read, edit, or touch |
| `D:\projetos\ephicaz-30\` | ❌ **FORBIDDEN** | Another Antigravity project |
| `D:\projetos\paperclip\` | ✅ ALLOWED | Paperclip infrastructure |
| Any other `D:\projetos\` folder NOT created by you | ❌ **FORBIDDEN** | Ask the Board first |

**GOLDEN RULE: If a folder was NOT created by you or is NOT listed as ALLOWED, you CANNOT edit it. EVER.**

### Database Boundaries — ABSOLUTE AND NON-NEGOTIABLE

| Database | Host | Permission | Description |
|----------|------|------------|-------------|
| BD Espelho (ALTERDATA_SHOP_ESPELHO) | 192.168.2.163 | ✅ READ ONLY* | Read-only for general queries. **UPDATE allowed ONLY via `syncService`** for approved SAV corrections on `pessoas` and `crediar` tables. |
| BD Ecossistema (ECOSSISTEMA_ATOMICO) | 192.168.2.163 | ✅ Read/Write | Application's internal governance and intelligence data. |
| **BD Principal (ALTERDATA_SHOP)** | **192.168.2.103** | ❌ **ABSOLUTELY FORBIDDEN** | Production ERP. NEVER CONNECT. |
| **Any database on 192.168.2.103** | **192.168.2.103** | ❌ **ABSOLUTELY FORBIDDEN** | Production ERP. NEVER CONNECT. |

**⚠️ CONNECTING TO 192.168.2.103 IS PROHIBITED. This is the PRODUCTION ERP. One wrong query destroys real business data. ZERO EXCEPTIONS.**

### If you are blocked by these rules
1. **DO NOT bypass the restriction**
2. Register the blocker in `Paperclip\EAV\sessoes\` with title `[PC] [BLOQUEIO] ...`
3. Create a Paperclip issue marked as `blocked` describing the problem
4. **Wait for Board instructions** — do not proceed

---

## Architectural Vision

The **Ecossistema Atômico** is a high-performance, resilient desktop platform designed for the "Empório Natural" sales team. It follows a strictly decoupled, service-oriented architecture centered on data integrity (SAV Governance), intelligence (Priority Scoring), and operational continuity (Offline Mode).

### Project Structure
- **Backend (Electron Main):**
  - `main.js`: Application entry point, IPC orchestration, and secure validation layer.
  - `src/main/services/`: Specialized domain logic (Intelligence, Telemetry, Reconciliation, Notification).
  - `src/main/db/schema.sql`: Authoritative schema for the application's internal database.
  - `src/main/localDb.js`: Proactive SQLite cache and migration system.
- **Frontend (Renderer):**
  - `src/js/ui/components.js`: Unified Component Library for a consistent design language.
  - `src/js/utils.js`: Standardized utilities including a Toast Notification system.

## Engineering Standards
- **Resilience:** Dual-pool PostgreSQL (Mirror/Ecosystem) with a local SQLite fallback (Offline Mode).
- **Intelligence:** Centralized scoring engine in `intelligenceService.js` for real-time priority analysis.
- **Security:** Strict IPC argument validation via `safeInvoke` and sensitive credential masking.
- **Observability:** Centralized logging with file-based fallback and automated data reconciliation.
- **Credentials:** NEVER hardcode passwords. Always use `config.local.json` (gitignored).

## Technical Roadmap
1. **Offline Mode:** SQLite local cache with proactive warm-up and buffered corrections.
2. **SAV System:** Multi-state approval workflow with real-time navigational badges.
3. **Sync Service:** Automated background reconciliation and conflict resolution.
4. **Trigram Search:** High-performance fuzzy search optimized for large ERP datasets.
5. **Intelligence Engine:** Centralized priority scoring and churn detection logic.
6. **Telemetry:** Resilient tracking of user interactions and system performance.
7. **UI Component Library:** Standardized design system and interactive Toast alerts.
8. **Report Export:** PDF/Excel/TXT export for product and client analytics.
9. **Pilot Support (Phase 6):** Controlled 10-user power user pilot with real-time sentiment monitoring and operational gate verification.

## Phase 6 Operational Standards
- **Onboarding:** All Power Users must receive the official Welcome Pack and Quick Guide.
- **Sentiment Monitoring:** CMO must audit `v_sentimento_feedback` weekly.
- **SAV Gate:** All batch exports must be verified by a manager before ERP execution.
- **Infrastructure:** expansion beyond 10 users REQUIRES `max_connections >= 250` and full `docitem` permission sign-off.

## Vault Documentation
The shared knowledge vault is at `D:\obsidian\memoria-infinita\memoria-infinita\`
- You CAN read any file in the vault
- You can ONLY write inside `Paperclip\` subfolders
- See `Paperclip\_instrucoes.md` for full vault governance rules
