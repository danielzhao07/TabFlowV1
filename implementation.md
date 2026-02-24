# TabFlow Implementation Tracking

Living implementation plan for the TabFlow full rewrite: Windows Alt+Tab grid design with Neon backend and AI integration.

---

## Overview
Redesigning TabFlow from a list-based HUD to a visual grid of tab thumbnails (like Windows Alt+Tab), with search at the bottom, Neon serverless PostgreSQL, and Gemini AI semantic search.

---

## Step 1: Project Setup & Documentation
- [x] Create `agent.md` with project context, file map, and conventions.
- [x] Rewrite `implementation.md` as living tracker.
- [x] Re-add `dev:api` and `build:api` scripts to root `package.json`.
- [x] Verify `.gitignore` covers `.env`, `node_modules`, `.output`, `dist`.

## Step 2: Backend Migration to Neon
- [x] Update `apps/api/src/db/index.ts` to use Neon serverless driver with SSL.
- [x] Update `apps/api/.env.example` with Neon connection string format.
- [x] Update `apps/api/package.json` dependencies (cleaned unused, kept postgres.js with SSL).
- [x] Recreate all API source files from compiled dist (src was empty).
- [x] Create `SETUP.md` with Neon setup instructions.
- [x] Create `tsconfig.json`, `drizzle.config.ts` for API.
- [x] Verify: `tsc --noEmit` passes with zero errors.

## Step 3: UI Full Rewrite — Grid Layout
- [x] Create `components/hud/TabGrid.tsx` — responsive CSS grid container, ResizeObserver for cols.
- [x] Create `components/hud/GridCard.tsx` — favicon, group color stripe, badges, stagger animation.
- [x] Create `components/hud/BottomBar.tsx` — search at bottom, group pills, window/sort toggles.
- [x] Rewrite `components/hud/HudOverlay.tsx` — full-screen grid layout, ~150 lines.
- [x] Create `lib/hooks/useKeyboardNav.ts` — 2D navigation with measured cols from ResizeObserver.
- [x] Create `lib/hooks/useHudState.ts` — all state, computed values, loadHudData helper.
- [x] Create `lib/hooks/useTabActions.ts` — all tab action callbacks.
- [x] Add `gridColumns: 0` setting to `lib/settings.ts`.
- [x] Add `@keyframes cardIn` stagger animation to `style.css`.
- [x] Verify: `pnpm build` zero errors — ✅ 558 kB bundle, 10s build.
- [ ] Delete old now-unused components: TabCard.tsx, TabList.tsx, SearchBar.tsx, StatusBar.tsx.

## Step 4: Search & Advanced Features
- [x] Wire Fuse.js search to filter grid in-place (via `useHudState` → `fuse-search.ts`).
- [x] Integrate structured filters: `is:pinned`, `domain:x`, `group:name`, `is:duplicate`.
- [x] Wire command palette (`>` prefix) in HudOverlay.
- [x] Implement multi-select in grid: Ctrl+Click, Shift+Click, Ctrl+A.
- [x] Wire context menu (right-click on GridCard — full menu with 10+ items).
- [x] Wire drag-to-reorder in grid (HTML5 drag API, visual drop indicator).
- [x] Wire group suggestions into BottomBar (inline, pills).
- [x] Wire recently closed and snoozed sections below grid.
- [ ] Wire AI semantic search (`ai:` prefix) — depends on Step 6 (backend running).

## Step 5: Styling & Animations
- [x] Update `entrypoints/content/style.css` with `@keyframes cardIn`.
- [x] Add staggered card entry animation (18ms × index, capped at 200ms).
- [x] Add card hover scale(1.03) with inline transition.
- [x] Add selection glow border (cyan, 2px) with transition.
- [x] Glassmorphism: dark backdrop blur on overlay + card surfaces.

## Step 6: API Client & Backend Integration
- [x] Created `lib/api-client.ts` — fetch wrapper, health check, semantic search, workspaces, settings sync.
- [ ] Wire AI search results to render as GridCards (requires backend to be running with Gemini key).
- [ ] Test end-to-end: extension → API → Neon → response.

## Step 7: AWS Integration Verification
- [ ] Verify S3 thumbnail upload/retrieval works.
- [ ] Verify Cognito JWT auth works (production mode).
- [ ] Verify Dockerfile builds and runs.
- [ ] Verify CI/CD pipelines (.github/workflows/).

## Step 8: Polish & Final Documentation
- [ ] Update `CheatSheet.tsx` with 2D grid navigation shortcuts.
- [ ] Update `SETUP.md` with complete Neon setup.
- [ ] Update `agent.md` with final architecture.
- [ ] Final `pnpm build` — zero errors.
- [ ] Full test: Alt+Q → grid → search → switch → close.

---

## Changelog

### 2026-02-24 — Step 1: Project Setup
- Created `agent.md` with full project context, file maps, conventions.
- Rewrote `implementation.md` as living tracker with 8 steps.
- Re-added `dev:api` and `build:api` scripts to root `package.json`.
- Verified `.gitignore`.

### 2026-02-24 — Step 2: Backend Migration to Neon
- Recreated all 13 API source files (src/ was empty, only compiled dist/ existed).
- Added `ssl: 'require'` to postgres.js connection for Neon compatibility.
- Created `package.json`, `tsconfig.json`, `drizzle.config.ts`, `.env.example` for API.
- Created `SETUP.md` with complete Neon setup instructions.
- All TypeScript compiles clean (`tsc --noEmit` zero errors).

### 2026-02-24 — Step 3: UI Full Rewrite — Grid Layout
- Created `lib/hooks/useHudState.ts` — all HUD state + computed values + loadHudData helper.
- Created `lib/hooks/useTabActions.ts` — all tab action callbacks extracted from HudOverlay.
- Created `lib/hooks/useKeyboardNav.ts` — 2D arrow-key navigation using measured grid columns.
- Created `components/hud/GridCard.tsx` — Windows Alt+Tab card: favicon, group stripe, stagger anim.
- Created `components/hud/TabGrid.tsx` — auto-fill CSS grid with ResizeObserver for column count.
- Created `components/hud/BottomBar.tsx` — search bar at bottom, group suggestions, filter toggles.
- Rewrote `components/hud/HudOverlay.tsx` — full-screen grid layout, ~150 lines (was 689).
- Deleted old list components: TabCard, TabList, SearchBar, StatusBar.
- Added `gridColumns` setting and `@keyframes cardIn` CSS animation.
- Build: ✅ zero errors, 555 kB bundle.
