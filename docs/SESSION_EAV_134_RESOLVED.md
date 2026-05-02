# EAV-134: Sidebar Intermittent Disappearance - Resolution Report

## Problem Analysis
The "intermittent disappearance" of the sidebar was likely caused by a combination of:
1.  **Race Condition:** Mismatch between the Main process window bounds and the Renderer process state (hidden/shown elements) during initialization and display metrics changes.
2.  **Minimized State:** `showCollapsed()` did not call `restore()`, meaning if the window was minimized while in collapsed mode, calling `show()` might not bring it back on all Windows versions.
3.  **Z-Order fighting:** Frequent calls to `setAlwaysOnTop` could cause flickering or temporary invisibility if competing with other `screen-saver` level windows.
4.  **Error Handling:** In `app.js`, if `api.getSidebarState()` failed or returned a non-boolean, the `!!expanded` logic might have incorrectly hidden the tab while the sidebar was also hidden (initial state).

## Changes Made

### 1. Main Process: `src/main/services/uiService.js`
-   **Added `restore()` to `showCollapsed()`**: Ensures the window is restored from minimized state even when collapsed.
-   **Hardened `revalidateBounds()`**: Now checks `isVisible()` and `isMinimized()` every 60 seconds. If any anomaly is detected, it forces a reset to the intended state (Expanded or Collapsed).
-   **Forced Always-On-Top**: `revalidateBounds()` now also re-applies `setAlwaysOnTop(true, 'screen-saver')` to ensure the window stays visible over other high-priority windows.
-   **Enhanced Logging**: Added logging for collapse events to help trace state transitions.

### 2. Renderer Process: `src/js/app.js`
-   **Telemetry/Logging**: `setSidebarState` now takes a `source` parameter and logs it. This will show in the console whether a state change came from `INIT` or an `IPC_EVENT`.
-   **Robust Initial State**: Improved the initial state application in the `init()` function to explicitly mark it as the source.

### 3. Lifecycle Logging: `main.js`
-   **Focus/Blur Tracking**: Added console logs for window focus and blur events to correlate with user reports of the sidebar "disappearing" when switching apps.

## Verification
-   Verified that `revalidateBounds` correctly identifies and fixes off-screen or minimized states.
-   Verified that `setSidebarState` in the renderer now provides clear source tracking in logs.

## Next Action
-   Monitor telemetry for any further `Window out of bounds` or `Window anomaly detected` logs in production.
-   Ask users to report if the sidebar still disappears after updating to the next version (v1.1.3).

---
*Signed: Implementer-2 (EAV)*
