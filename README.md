# TabFlow

A full-stack Chrome extension that replaces the browser's native tab switcher with an
intelligent, keyboard-driven HUD. Tabs are navigated through a full-screen overlay inspired
by Windows Alt+Tab, with fuzzy search, natural-language AI search over browsing history,
cloud-synced workspaces, passive analytics, and automatic tab group suggestions.

Built end-to-end: Chrome extension (Manifest V3) + REST API (Express.js v5) + Neon
serverless PostgreSQL + Gemini AI embeddings + AWS Cognito OAuth 2.0 + S3.

---

## Features

### Tab Management
- Full-screen HUD overlay triggered by Alt+Q, with blur backdrop and stagger animation
- Most Recently Used (MRU) ordering — tabs sorted by last-accessed time, tracked by a
  background service worker across all windows and sessions
- Fuzzy search across titles, URLs, and notes using Fuse.js with configurable threshold
- Structured search filters: `is:pinned`, `is:audible`, `is:duplicate`, `domain:github.com`
- 2D arrow-key grid navigation — Enter to switch, Backspace to close
- Drag-to-reorder tabs within the grid
- Multi-select via Ctrl+click and Shift+click for bulk close, group, or move operations
- Tab group support — colored left-border stripe and name pill per group on each card
- Automatic group suggestions bar — detects ungrouped domains with 2+ open tabs and
  offers one-click grouping; also surfaces existing groups with live tab counts
- Duplicate tab detection with DUP badge
- Close all tabs from a domain in one command
- Quick-switch between the two most recent tabs (double-tap Alt+Q)
- Tab thumbnails captured via `captureVisibleTab` before the HUD opens, with LRU in-memory
  cache (max 60 entries); falls back to favicon + domain-hashed accent color

### Right-Click Context Menu
- Pin / Unpin tab
- Duplicate tab (opens same URL in a new adjacent tab)
- Move to new window
- Reload tab
- Close tab

### Search Modes
- Default: fuzzy search scoring title, URL, and attached notes
- `ai: describe a page` — natural-language semantic search powered by Gemini embeddings
  stored in Neon PostgreSQL with pgvector cosine similarity; searches both open tabs and
  closed tabs from browsing history. Shows clear loading, error ("API offline"), and
  empty-state feedback
- `> command` — command palette for bulk operations

### Workspaces
- Name and save the current window's tabs as a named workspace
- Restore a workspace — opens all saved URLs in a new window, filtered of restricted URLs
- Update an existing workspace with the current tabs via the ↑ button
- Delete workspaces — changes sync to Neon via REST API
- Workspaces persist across sessions and devices under the authenticated user account

### Snooze
- Snooze any tab for 30 min, 1 hr, 3 hrs, tomorrow, or next week
- Snoozed tabs are removed from the browser; `chrome.alarms` schedules the wake event
- Snoozed tab list shown in a collapsible section within the HUD

### Recently Closed Tabs
- 10 most recently closed tabs shown in a collapsible section
- One-click restore via `chrome.sessions`

### Notes
- Attach a text note to any tab's URL via the command palette (`>note`)
- Notes persist in `chrome.storage.local` and sync to cloud when signed in
- Note preview overlaid on the tab card

### Analytics
- Passive visit tracking: every tab activation records URL, domain, title, and duration
  to Neon PostgreSQL via a fire-and-forget API call
- Top-sites bar in the HUD header shows most-visited domains with relative bar charts
- Falls back to local frecency data (visit counts from `chrome.storage.local`) when the
  API is offline, so analytics always shows something useful

### Tab Suspender
- Background alarm runs every 5 minutes, discards tabs inactive beyond a configurable
  threshold (default 30 min) to reclaim memory
- Skips pinned, active, and audible tabs

### Authentication
- AWS Cognito hosted UI — OAuth 2.0 Authorization Code flow with PKCE
- Sign-in opens a popup window; the background service worker intercepts the callback
  redirect and exchanges the authorization code via the backend (client secret never
  leaves the server)
- JWT validation uses `express-jwt` + `jwks-rsa` pulling Cognito's JWKS endpoint
- Graceful fallback to a device UUID for unauthenticated / offline use

### Command Palette
- Activated by typing `>` in the search bar
- Commands: close duplicates, group/ungroup selected tabs, cycle sort mode, toggle window
  filter (all windows vs current), open settings, open keyboard cheat sheet

---

## Tech Stack

### Extension (`apps/extension/`)

| Technology | Role |
|---|---|
| WXT 0.19 | Chrome extension framework — Manifest V3, shadow DOM mounting, HMR dev mode |
| React 19 | Component library for the HUD overlay (injected via content script) |
| TypeScript 5.6 | Full type safety across all extension code |
| Tailwind CSS 3.4 | Utility-first styling scoped to the shadow DOM |
| Fuse.js 7 | Client-side fuzzy search with weighted title/URL/notes scoring |
| Chrome APIs | tabs, tabGroups, sessions, storage, alarms, identity, captureVisibleTab, windows |

### API (`apps/api/`)

| Technology | Role |
|---|---|
| Express.js 5 | HTTP server and routing |
| TypeScript 5.7 | Full type safety across all API code |
| Drizzle ORM | Type-safe SQL query builder and schema migrations |
| postgres.js 3 | PostgreSQL driver with SSL (required for Neon serverless) |
| Zod | Runtime request schema validation |
| express-jwt + jwks-rsa | Cognito JWT verification via JWKS public key rotation |

### Cloud Infrastructure

| Service | Role |
|---|---|
| Neon (serverless PostgreSQL) | Primary database — workspaces, embeddings, analytics, notes, bookmarks |
| pgvector | PostgreSQL extension for 768-dimensional cosine similarity search |
| AWS Cognito | User pool, hosted login UI, OAuth 2.0 Authorization Code + PKCE |
| AWS S3 | Tab screenshot storage with presigned URLs (per-user key namespacing) |
| AWS App Runner | Containerized API deployment with auto-scaling |
| Google Gemini API | `gemini-embedding-001` model — 768-dim tab title/URL embeddings |

### Tooling

| Tool | Role |
|---|---|
| pnpm workspaces | Monorepo dependency management across extension and API packages |
| Vite 6 | Extension bundler (via WXT) |
| PM2 | API process management and auto-restart in local development |
| drizzle-kit | Schema push and database introspection |

---

## Architecture

```
tabflow/
├── apps/
│   ├── extension/                  # Chrome extension (Manifest V3)
│   │   ├── entrypoints/
│   │   │   ├── background/         # Service worker: MRU tracking, thumbnail capture,
│   │   │   │                       # analytics reporting, snooze alarms, tab embedding,
│   │   │   │                       # message bus for all Chrome API calls
│   │   │   ├── content/            # Content script: mounts HudOverlay into shadow DOM
│   │   │   ├── options/            # Settings page (search threshold, suspend timeout, etc.)
│   │   │   └── popup/              # Toolbar popup
│   │   ├── components/hud/         # 14 React components:
│   │   │                           # HudOverlay, TabGrid, GridCard, BottomBar,
│   │   │                           # WorkspaceSection, GroupSuggestions, AnalyticsBar,
│   │   │                           # ContextMenu, CheatSheet, UndoToast, CommandPalette,
│   │   │                           # RecentlyClosedSection, SnoozedSection, WindowStrip
│   │   └── lib/
│   │       ├── hooks/              # useHudState, useTabActions, useKeyboardNav
│   │       └── *.ts                # fuse-search, frecency, bookmarks, notes, snooze,
│   │                               # api-client, auth (PKCE), settings, types, mru
│   └── api/                        # Express.js REST API
│       └── src/
│           ├── db/                 # Drizzle schema (7 tables) + Neon connection
│           ├── routes/             # sync (workspaces/bookmarks/notes/settings),
│           │                       # ai (embed + semantic search), analytics, thumbnails, auth
│           ├── middleware/         # Cognito JWT auth with device-ID fallback
│           └── services/           # S3 upload / presigned URL generation / deletion
├── ecosystem.config.cjs            # PM2 process definition
└── package.json                    # Root scripts
```

### Data Flow

```
Alt+Q keypress
  │
  └─► Background service worker
        ├── captureVisibleTab()  →  in-memory thumbnail cache (LRU, max 60)
        ├── embedTab()           →  POST /api/ai/embed  →  Gemini  →  pgvector (Neon)
        └── toggles HUD via message to content script
              │
              └─► Content script (shadow DOM)
                    └─► HudOverlay (React)
                          ├── fetchTabs()         →  background: get-tabs (MRU + live Chrome)
                          ├── workspaces          →  GET  /api/sync/workspaces
                          ├── ai: <query>         →  GET  /api/ai/history?q=  (pgvector)
                          ├── analytics           →  GET  /api/analytics/top-domains
                          └── visit tracking      →  POST /api/analytics/visit  (passive)
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Cognito sub + email, created on first sign-in |
| `workspaces` | Named tab sets (JSONB array of url/title/favicon) |
| `bookmarks` | Cloud-synced bookmarks with favicon |
| `notes` | Per-URL text notes |
| `tab_embeddings` | 768-dim Gemini vectors for semantic search (real[]) |
| `tab_analytics` | Per-URL visit count + total duration |
| `user_settings` | JSONB settings blob, upserted on change |

---

## API Reference

All endpoints require `Authorization: Bearer <cognito-token>` or `x-device-id` (UUID,
generated automatically by the extension on first run).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — returns auth mode and service status |
| POST | `/api/auth/token` | Exchange Cognito auth code for tokens (PKCE proxy) |
| GET | `/api/sync/workspaces` | List user's saved workspaces |
| POST | `/api/sync/workspaces` | Save a new workspace |
| PATCH | `/api/sync/workspaces/:id` | Update workspace tabs |
| DELETE | `/api/sync/workspaces/:id` | Delete a workspace |
| POST | `/api/sync/bookmarks` | Sync a bookmark to cloud |
| POST | `/api/sync/notes` | Sync a note to cloud |
| PUT | `/api/sync/settings` | Upsert user settings |
| POST | `/api/ai/embed` | Generate and store Gemini embedding for a URL |
| GET | `/api/ai/history?q=` | Semantic search over stored embeddings |
| POST | `/api/analytics/visit` | Record a tab visit with duration |
| GET | `/api/analytics/top-domains` | Top domains by visit count and total time |
| POST | `/api/thumbnails/upload` | Get presigned S3 URL for screenshot upload |
| GET | `/api/thumbnails/:tabId` | Get presigned S3 URL for screenshot retrieval |

---

## Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Chrome or Chromium-based browser
- Neon PostgreSQL database
- (Optional) AWS account for Cognito, S3, App Runner
- (Optional) Google Cloud project with Generative AI API enabled

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the API

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
GEMINI_API_KEY=your_gemini_api_key

# AWS (optional — required for auth and S3 thumbnails)
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket
COGNITO_USER_POOL_ID=us-east-2_xxxxx
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_DOMAIN=https://your-domain.auth.us-east-2.amazoncognito.com
```

### 3. Run database migrations

```bash
cd apps/api
pnpm drizzle-kit push
```

### 4. Start the API

```bash
# Development (tsx watch)
pnpm dev:api

# Production (PM2, auto-restart)
pnpm pm2:start
```

The API runs on `http://localhost:3001` by default.

### 5. Build and load the extension

```bash
pnpm build
```

In Chrome: `chrome://extensions` → Enable Developer mode → Load unpacked →
select `apps/extension/.output/chrome-mv3`

---

## Usage

| Action | How |
|---|---|
| Open / close HUD | Alt+Q / Esc |
| Navigate tabs | Arrow keys |
| Switch to tab | Enter or click card |
| Close tab | Backspace or X button on card |
| Search tabs | Type in the bottom search bar |
| Semantic AI search | Type `ai: describe what you're looking for` |
| Command palette | Type `>` in the search bar |
| Multi-select | Ctrl+click or Shift+click |
| Quick-switch | Double-tap Alt+Q |
| Save workspace | Click `+ Save current` in the Workspaces bar |
| Update workspace | Click `↑` next to a saved workspace |
| Restore workspace | Click the workspace card |
| Auto-group suggestion | Click a domain pill in the Groups bar |
| Cheat sheet | Press `?` while HUD is open |

---

## Development

```bash
# Extension dev server (HMR)
pnpm dev

# API dev server (tsx watch)
pnpm dev:api

# Build extension for production
pnpm build

# Package as .zip for submission
pnpm zip

# PM2 process management
pnpm pm2:start
pnpm pm2:logs
pnpm pm2:status
pnpm pm2:stop
```
