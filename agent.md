# TabFlow - Agent Context

## What is TabFlow?
A Chrome extension that replaces Alt+Tab with a visual grid of tab thumbnails (like Windows Alt+Tab), built with fuzzy search, AI semantic search, cloud sync, and full tab management.

## Architecture
- **Monorepo**: pnpm workspaces at root
- **Extension**: `apps/extension/` — WXT framework, React 19, TypeScript, Tailwind CSS, Manifest V3
- **Backend API**: `apps/api/` — Express.js, Drizzle ORM, Neon (serverless PostgreSQL), Gemini AI, AWS S3/Cognito

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Extension framework | WXT (Web eXtension Toolkit) |
| UI | React 19 + Tailwind CSS |
| Search | Fuse.js (fuzzy) + Gemini (semantic) |
| Database | Neon (serverless PostgreSQL) + Drizzle ORM |
| AI | Google Gemini `text-embedding-004` + pgvector |
| Auth | AWS Cognito (JWT) |
| Storage | AWS S3 (thumbnails), chrome.storage.local (local data) |
| Deployment | AWS App Runner (API), Chrome Web Store (extension) |
| CI/CD | GitHub Actions |

## Key Commands
```bash
pnpm install          # Install all dependencies
pnpm dev              # Extension dev server (hot reload)
pnpm build            # Build extension for production
pnpm dev:api          # API dev server (tsx watch)
pnpm build:api        # Build API (tsc)
```

## Extension File Map
```
apps/extension/
├── wxt.config.ts                    # Manifest, permissions, commands (Alt+Q)
├── tailwind.config.ts               # Design system tokens
├── entrypoints/
│   ├── background/index.ts          # Service worker: MRU, message handling, thumbnail cache, tab suspender
│   ├── content/index.tsx            # Content script: mounts HUD overlay
│   ├── content/style.css            # Global styles, fonts, scrollbar, glass utilities
│   ├── popup/App.tsx                # Popup: tab stats, workspace management
│   └── options/                     # Options page: settings, shortcuts, export/import
├── components/hud/
│   ├── HudOverlay.tsx               # Main overlay: backdrop + grid + bottom bar
│   ├── TabGrid.tsx                  # Responsive CSS grid container
│   ├── GridCard.tsx                 # Tab card: thumbnail + favicon + title + close
│   ├── BottomBar.tsx                # Search input + group suggestions + keyboard hints
│   ├── ContextMenu.tsx              # Right-click menu
│   ├── CommandPalette.tsx           # Command mode (type > in search)
│   ├── CheatSheet.tsx               # Keyboard shortcuts modal (press ?)
│   ├── GroupSuggestions.tsx          # Auto-suggest grouping 3+ tabs from same domain
│   ├── RecentlyClosedSection.tsx    # Collapsible recently closed tabs
│   ├── UndoToast.tsx                # Undo close notification
│   ├── SnoozeMenu.tsx               # Snooze duration picker
│   └── AiSearchResults.tsx          # AI semantic search results
├── lib/
│   ├── types.ts                     # TabInfo, RecentTab, MRUMessage interfaces
│   ├── mru.ts                       # MRU list logic with tab group info
│   ├── utils.ts                     # getDomain, domainColor, timeAgo, ageColor, GROUP_COLORS
│   ├── fuse-search.ts               # Fuzzy + structured search (is:pinned, domain:x)
│   ├── frecency.ts                  # Frecency scoring (frequency x recency)
│   ├── bookmarks.ts                 # Tab bookmarks (star favorites)
│   ├── notes.ts                     # Persistent per-URL tab notes
│   ├── snooze.ts                    # Tab snooze with alarm-based wake
│   ├── settings.ts                  # TabFlowSettings (autoSuspend, gridColumns, etc.)
│   ├── storage.ts                   # chrome.storage.local wrapper
│   ├── workspaces.ts                # Workspace save/restore
│   ├── export-import.ts             # Export/import all data as JSON
│   ├── api-client.ts                # HTTP client for backend API
│   ├── content-extractor.ts         # Page content extraction for AI embeddings
│   └── hooks/
│       ├── useHudState.ts           # All HUD state, data fetching, visibility
│       ├── useTabActions.ts         # Tab action callbacks (close, pin, bookmark, etc.)
│       ├── useKeyboardNav.ts        # 2D grid keyboard navigation
│       └── useSemanticSearch.ts     # AI search with ai:/? prefixes
```

## API File Map
```
apps/api/
├── src/
│   ├── index.ts                     # Express server, CORS, auth, routes
│   ├── db/
│   │   ├── index.ts                 # Drizzle + Neon connection
│   │   └── schema.ts               # 7 tables: users, workspaces, bookmarks, notes, tab_embeddings, tab_analytics, user_settings
│   ├── routes/
│   │   ├── sync.ts                  # CRUD: workspaces, bookmarks, notes, settings
│   │   ├── ai.ts                    # Gemini embeddings + cosine similarity search
│   │   ├── analytics.ts            # Visit tracking, top domains, usage summary
│   │   └── thumbnails.ts           # S3 upload/retrieve/delete
│   ├── middleware/
│   │   └── auth.ts                  # Cognito JWT validation (requireAuth, optionalAuth)
│   └── services/
│       └── s3.ts                    # S3 upload, presigned URLs, deletion
├── .env.example
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

## Conventions
- **Keyboard shortcut**: Alt+Q toggles HUD, double-tap Alt+Q quick-switches
- **Permissions**: tabs, activeTab, storage, favicon, sessions, tabGroups, alarms, scripting
- **Message passing**: UI ↔ background via chrome.runtime.sendMessage
- **State management**: Custom hooks (useHudState, useTabActions, useKeyboardNav)
- **Styling**: Tailwind CSS with glassmorphism (blur + transparent backgrounds + borders)
- **Search prefixes**: `ai:` or `?` = AI search, `>` = command palette, `is:` / `domain:` = filters
- **Storage keys**: tabflow_mru, tabflow_settings, tabflow_bookmarks, tabflow_notes, tabflow_snoozed, tabflow_workspaces, tabflow_frecency
- **Grid navigation**: Arrow keys move in 2D grid (left/right/up/down), wraps at row boundaries

## Important Notes
- Content scripts can't run on chrome://, edge://, brave:// URLs
- Ctrl+D is Chrome's bookmark shortcut — use Ctrl+B instead
- Number keys 1-9 only fire when not typing in search input
- Tab suspender skips pinned, active, and audible tabs
- Thumbnails cached in background worker memory (Map, max 60 entries)
- Backend auth is optional: Cognito in prod, x-user-id header in dev
