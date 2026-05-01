# SAV: Operational Gate & Batch Execution Plan

## 1. Architectural Strategy
To maintain data integrity and adhere to security boundaries, direct writing from the application to the Production ERP Database (192.168.2.103) is **prohibited**. Instead, a tiered synchronization and execution model is employed.

### Tiers of Operation:
1.  **Tier 1: Request & Buffer (Ecosystem DB)**
    - All field corrections are stored as `PENDING` actions in the `ECOSSISTEMA_ATOMICO` database.
    - These requests are visible in the SAV Queue but have zero impact on ERP data.
2.  **Tier 2: Managerial Approval (SAV Queue)**
    - Managers review requests. Approving an action moves it to the `APPROVED` state.
3.  **Tier 3: Staging Sync (Mirror DB)**
    - `syncService.js` automatically applies `APPROVED` changes to the Mirror Database (192.168.2.163).
    - This allows for immediate high-performance search updates within the app without touching the ERP.
4.  **Tier 4: Controlled ERP Execution (Operational Gate)**
    - A DBA or authorized operator executes a batch script on the Production ERP Database (`.103`).

## 2. The Operational Gate (Gatekeeper)
The "Operational Gate" is the final human-in-the-loop validation before ERP modification.

### Workflow:
1.  **Script Generation:** The application provides a "Batch SQL" export feature that aggregates all `APPROVED` actions that have been successfully synced to the Mirror.
2.  **Validation:** The operator reviews the SQL script for anomalies or large-scale destructive patterns.
3.  **Execution:** The script is executed against the `ALTERDATA_SHOP` database on `192.168.2.103`.
4.  **Finalization:** Once confirmed, the actions are marked as `DONE` in the Ecossistema database (manually or via a reconciliation script).

## 3. Risk Mitigation
- **Read-Only App:** The application only possesses `READ` credentials for the Mirror and `READ/WRITE` for its own private Ecosystem DB.
- **Audit Trail:** Every transition (Pending -> Approved -> Done) is logged with a timestamp and the actor's ID.
- **Rollback Capability:** Since changes are first applied to the Mirror, any errors can be detected and the Mirror can be resynced from the ERP if the Batch Execution is aborted.

## 4. Next Steps & Ongoing Operations
- ✅ Implement `generateBatchScript` in `syncService.js`.
- ✅ Add "Export Batch SQL" button to the Sync Module UI (Professional Dialog workflow).
- 🕒 **Operational Task:** Establish a weekly maintenance window (e.g., Tuesday at 08:00) for the DBA to apply the SAV batches.
- 🕒 **Monitoring:** Use the Health Dashboard 2.0 to track 'Sync Latency' and ensure the Operational Gate is processing items within expected SLAs.

---
*Updated by CEO (EAV)*
