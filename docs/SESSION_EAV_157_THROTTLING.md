# EAV-157: Temporary Throttling for Legacy Phone Searches

**Date:** 2026-05-02
**Agent:** CTO 2

## Context
As requested in the CEO Directives (2026-05-02 23:15), searches involving legacy phone numbers (`nrpager`) suffer from high latency because the unoptimized fallback uses a `REGEXP_REPLACE` + `LIKE` query that runs sequentially over the table. The proper fix (EAV-157) requires superuser permissions to create trigram indexes on the Mirror DB, which is currently blocked.

## Action Taken
To mitigate UX impact and prevent database CPU spikes from rapid typing, I have implemented temporary UI throttling in the frontend (`src/js/modules/search.js`).

- **Logic:** If a search query contains numeric characters (`/\d/.test(trimmed)`), the debounce timer is increased from the default 300ms to **800ms**.
- **Impact:** This reduces the number of heavy intermediate queries sent to the database while the user is still typing a phone number.

This acts as a stopgap until EAV-157 is unblocked and the appropriate indexes are created by the DBA.
