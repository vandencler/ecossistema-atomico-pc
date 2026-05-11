# Graph Report - D:\projetos\ecossistema-atomico-pc  (2026-05-05)

## Corpus Check
- 179 files · ~85,697 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 375 nodes · 833 edges · 52 communities (47 shown, 5 thin omitted)
- Extraction: 67% EXTRACTED · 33% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `create()` - 50 edges
2. `$()` - 45 edges
3. `setChildren()` - 38 edges
4. `stateMessage()` - 26 edges
5. `logError()` - 25 edges
6. `getLocalDb()` - 19 edges
7. `logEvent()` - 19 edges
8. `toast()` - 16 edges
9. `UIService` - 15 edges
10. `openClient()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `runPreFlight()` --calls--> `getDbStatus()`  [INFERRED]
  main.js → src/main/services/configService.js
- `runPreFlight()` --calls--> `initializeDatabase()`  [INFERRED]
  main.js → src/main/dbInit.js
- `runPreFlight()` --calls--> `logEvent()`  [INFERRED]
  main.js → src/main/services/logService.js
- `runPreFlight()` --calls--> `logError()`  [INFERRED]
  main.js → src/main/services/logService.js
- `setupOnboardingConfigs()` --calls--> `setSystemConfig()`  [INFERRED]
  scripts/setup_onboarding_params.js → src/main/services/configService.js

## Communities (52 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (46): checkSystemHealth(), init(), setSidebarState(), setupNotifications(), setupSidebar(), $(), setChildren(), stateMessage() (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (37): dbConfig(), readEnv(), getLocalDb(), initLocalDb(), runMigrations(), dateParts(), daysSince(), isBirthdayToday() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (20): runPreFlight(), initializeDatabase(), getBirthdayCustomers(), getConfigValue(), getDbStatus(), bulkExportByPriority(), bulkExportClients(), exportClientData() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (41): appendChildren(), badge(), create(), fmtDate(), fmtMoney(), fmtPhone(), onlyDigits(), pad2() (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (6): setupOnboardingConfigs(), getConfig(), _readRawConfig(), saveConfig(), setSystemConfig(), UIService

### Community 5 - "Community 5"
Cohesion: 0.21
Nodes (21): getActionHistory(), getActionQueue(), hydrateQueueRows(), logActionHistory(), markActionExecutionDone(), markActionExecutionError(), markActionExecutionStarted(), normalizeActionId() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (10): generateBatchScript(), loadApprovedAction(), normalizeSyncItems(), performSync(), reconcileLocalCorrections(), resolveSyncTarget(), runInClientTransaction(), startAutoSync() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (3): clampScore(), hoursSince(), IntelligenceService

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (10): createCheckbox(), createField(), loadConfigModule(), renderConfigForm(), renderDbStatus(), renderIdentitySection(), renderOpsMetrics(), renderSupportLinks() (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.43
Nodes (5): evaluateChurnModel(), processAffinityScores(), processChurnScores(), run(), sigmoid()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logError()` connect `Community 2` to `Community 1`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `logEvent()` connect `Community 2` to `Community 1`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `getLocalDb()` connect `Community 1` to `Community 2`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 34 inferred relationships involving `create()` (e.g. with `handleEditClick()` and `populateSelect()`) actually correct?**
  _`create()` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `$()` (e.g. with `checkSystemHealth()` and `setSidebarState()`) actually correct?**
  _`$()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `setChildren()` (e.g. with `handleEditClick()` and `populateSelect()`) actually correct?**
  _`setChildren()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `stateMessage()` (e.g. with `openClient()` and `doSearch()`) actually correct?**
  _`stateMessage()` has 14 INFERRED edges - model-reasoned connections that need verification._