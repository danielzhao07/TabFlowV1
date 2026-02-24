# TabFlow — Implementation Plan (Updated)

## Round 2 Fixes (Latest)

### Bug 1: Workspace Restore [DONE]
- `saveWorkspace` response unwrapped (`{ workspace: {...} }` → `Workspace`)
- Restricted URLs (`chrome://`, `about:`) filtered on save AND restore

### Bug 2: Card Size [DONE]
- Cards increased from 200x150 to 240x175
- Container maxWidth increased to 1300px

### Bug 3: Stale "New Tab" Titles [DONE]
- `get-tabs` handler now merges live `chrome.tabs.query()` data into MRU list
- Fresh titles/URLs/favicons override stale cached values

---

# TabFlow HUD — 5 Bug Fixes & UI Redesign

## Context

The backend integration (Cognito auth, workspace sync) is working. The user reported 5 issues after testing:

1. Clicking saved workspaces does nothing
2. Deleted tabs still show in extension
3. Thumbnails sometimes capture the HUD overlay instead of actual page
4. Tab grid not centered — wants Windows Alt+Tab centered layout
5. Need sign out button + sleek minimal design

---

## Fix 1: Workspace Restore Not Working [DONE]

**Problem:** `WorkspaceSection.tsx:handleRestore` calls `chrome.windows.create()` directly. But the HUD runs as a content script — `chrome.windows` is NOT available in content scripts, only in the background worker.

**Fix:** Route workspace restore through background message passing (same pattern as sign-in/sign-out).

**Files:**
- `apps/extension/components/hud/WorkspaceSection.tsx` — change `handleRestore` to send message
- `apps/extension/entrypoints/background/index.ts` — add `restore-workspace` message handler

---

## Fix 2: Deleted Tabs Still Showing

**Problem:** When user closes a tab in Chrome, the HUD still shows it because the tab list was fetched on HUD open and never refreshed.

**Fix:**
- Listen for `chrome.tabs.onRemoved` in the background and broadcast tab removal events
- In HudOverlay, re-fetch tabs when HUD becomes visible (already done via `fetchTabs()` on open)
- Ensure `fetchTabs()` gets fresh data from `chrome.tabs.query()` each time
- Add `chrome.runtime.onMessage` listener in the HUD to handle real-time tab removal updates while the HUD is open

**Files:**
- `apps/extension/entrypoints/background/index.ts` — ensure tab removal events are tracked
- `apps/extension/lib/hooks/useHudState.ts` — verify `fetchTabs()` queries fresh Chrome tabs

---

## Fix 3: Thumbnails Capturing HUD Overlay

**Problem:** `captureVisibleTab` runs on tab activation. When the HUD opens (Alt+Q), the capture fires but the HUD overlay is already visible, so the screenshot includes the dark overlay + tab grid instead of the actual page.

**Fix:** Add a `hudVisible` flag in the background worker. Skip thumbnail capture when HUD is visible. Capture the active tab BEFORE toggling HUD on.

**Files:**
- `apps/extension/entrypoints/background/index.ts`:
  - Add `let hudVisible = false;` flag
  - On `toggle-hud` command: capture thumbnail FIRST, then toggle
  - In `captureThumbnail()`: skip if `hudVisible === true`
  - On `hud-closed` message: set `hudVisible = false`

---

## Fix 4: Windows Alt+Tab Centered Layout

**Problem:** Current grid fills the entire screen. User wants centered cards in a rectangle with transparent background, similar to Windows Alt+Tab.

**Design:**
- Keep full-screen dark transparent backdrop (click to close)
- Add a centered container with slightly brighter background + subtle border
- Grid cards inside this container, centered
- Last row centered (use flexbox wrapping)
- Selected card gets a bright outline
- Container has rounded corners and a subtle glass effect

**Layout structure:**
```
┌──────────────── full screen backdrop (rgba(0,0,0,0.5) + blur) ──────────────┐
│                                                                               │
│       ┌─────────── centered container (rgba(20,20,35,0.85)) ──────────┐      │
│       │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                                    │      │
│       │  │  │ │  │ │  │ │  │ │  │   ← grid row 1                     │      │
│       │  └──┘ └──┘ └──┘ └──┘ └──┘                                    │      │
│       │       ┌──┐ ┌──┐ ┌──┐                                         │      │
│       │       │  │ │  │ │  │        ← grid row 2 (centered)          │      │
│       │       └──┘ └──┘ └──┘                                         │      │
│       └───────────────────────────────────────────────────────────────┘      │
│                                                                               │
│  ┌─ Workspaces: [Work ×] [Research ×]  ───── + Save current ──────────────┐  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ 🔍 Search tabs…                                                  ────┐  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Files:**
- `apps/extension/components/hud/HudOverlay.tsx` — restructure layout
- `apps/extension/components/hud/TabGrid.tsx` — flexbox centering, fixed card widths
- `apps/extension/components/hud/GridCard.tsx` — adjust for fixed-size cards

---

## Fix 5: Sign Out Button + Sleek Minimal Design

**Problem:** No explicit sign-out button. UI has too many colors.

**Fix:**
- Add a small "Sign out" text button next to the user email in the header
- Tone down colors: reduce cyan usage, use more white/gray
- Header: more minimal — just "TabFlow" + tab count on left, sign out on right
- Remove the green API status dot
- Remove "ESC to close" text

**Files:**
- `apps/extension/components/hud/HudOverlay.tsx` — simplify header, sign out button
- `apps/extension/components/hud/GridCard.tsx` — subtler borders
- `apps/extension/components/hud/BottomBar.tsx` — lighter styling

---

## Verification

1. `pnpm build` in project root
2. Reload extension in Chrome
3. Open 8+ tabs, press Alt+Q → HUD shows centered grid with last row centered
4. Save a workspace → click it → new window opens with all tabs
5. Close a tab in Chrome → reopen HUD → closed tab is gone
6. Switch between tabs rapidly → thumbnails show actual pages, not HUD
7. Sign out button visible and working
