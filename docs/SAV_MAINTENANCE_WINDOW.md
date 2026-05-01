# Weekly Maintenance Window Proposal (EAV-104)
**Project:** Ecossistema Atômico de Vendas (EAV)
**Recipient:** DBA Team
**Status:** Draft for Review
**Proposed Start Date:** 2026-05-05

## 1. Rationale
To ensure the integrity of the Production ERP Database (192.168.2.103) while maintaining operational consistency across the Ecossistema Atômico platform, we propose the formalization of a weekly maintenance window.

### Operational Gate (Tier 4)
The EAV application operates under a strict "Operational Gate" architecture. All field corrections (SAV - Sistema de Apoio a Vendas) are buffered in the Ecosystem Database and synced to a Mirror Database for immediate use. However, to finalize these changes in the source of truth (ERP), a controlled batch execution is required.

**Key Benefits:**
- **Safety:** Prevents direct, unvetted writes from the application to Production.
- **Consistency:** Ensures the ERP, Mirror, and EAV caches remain synchronized.
- **Auditability:** Centralizes all ERP modifications into a single, reviewable batch script.

## 2. Proposed Time & Frequency
We propose a recurring maintenance window to minimize impact on peak sales hours:

- **Day:** Every Tuesday
- **Time:** 08:00 AM (Local Time)
- **Duration:** Estimated 15-30 minutes
- **Frequency:** Weekly

*Note: This window was selected to precede the main weekly sales review, ensuring the team works with corrected data.*

## 3. Procedure
The execution follows a 4-step workflow to ensure zero-defect deployments.

### 3.1 Script Delivery
- **Generator:** The EAV Application (Sync Service) generates a standard PostgreSQL-compatible SQL script containing all `APPROVED` corrections.
- **Location:** The script will be deposited in the secure shared directory `\\SRV-FS-01\DBA_Dropzone\EAV_Batches\` by 17:00 every Monday.
- **Filename Pattern:** `EAV_BATCH_YYYY-MM-DD_vX.sql`

### 3.2 First Batch Execution (May 5th, 2026)
- **Prerequisite:** Before generating the first batch, ensure the EAV Ecosystem Database has been prepared using `scripts/apply_missing_tables.js` to establish the necessary `notify_sav_approved` triggers.
- **Scope:** The inaugural script (`EAV_BATCH_2026-05-04_v1.sql`) will contain the backlog of all corrections accumulated during the pilot phase. 
- **Attention:** The DBA team should expect a higher-than-average row count for this first run. Additional review time is recommended.

### 3.3 Review & Approval
- The DBA team reviews the script for syntax errors, destructive patterns, or performance impacts.
- Approval is communicated via the Paperclip/EAV internal messaging or email before 08:00 Tuesday.

### 3.4 Execution (Operational Gate)
- The DBA executes the script against the `ALTERDATA_SHOP` database on **192.168.2.103**.
- The script MUST be executed within a transaction block (see Risks & Mitigations).

### 3.5 Verification & Finalization
- **Verification:** DBA confirms successful execution (row count match).
- **Update:** Once confirmed, the EAV team runs the `reconciliationService` to mark these items as `DONE` in the Ecosystem database.
- **Sync:** The Mirror Database (192.168.2.163) will be automatically refreshed from the ERP post-execution.

## 4. Risks & Mitigations

| Risk | Mitigation Strategy |
|------|---------------------|
| **Data Corruption** | All scripts are wrapped in `BEGIN; ... COMMIT;` blocks. Any error triggers an automatic `ROLLBACK`. |
| **Performance Degradation** | Window is scheduled during low-traffic hours; scripts focus on indexed PK updates only. |
| **Inconsistent State** | EAV locks the affected records in 'Syncing' state during the window to prevent concurrent edits. |
| **System Unavailability** | A full backup of the target tables is recommended (standard DBA procedure) before execution. |

## 5. Rollback Plan
In the event of a post-execution failure:
1. The DBA performs a point-in-time recovery or restores the specific table backup.
2. The EAV team resets the `DONE` status to `APPROVED` in the Ecosystem DB to allow for correction and re-inclusion in the next batch.

## 🟢 CEO APPROVAL & SIGNATURE (2026-05-01)
This proposal is finalized and approved. 
Assigned to: **Operations** and **DBA Team**.
Execution starts: **2026-05-05 (Tuesday)**.

---
**Approved by:** CEO, Ecossistema Atômico
**Prepared by:** CEO, Ecossistema Atômico
**Date:** 2026-05-01

