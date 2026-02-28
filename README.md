<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white" alt="Neon PostgreSQL" />
  <img src="https://github.com/danielzhao07/TabFlowV1/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" />
  <img src="https://img.shields.io/github/last-commit/danielzhao07/TabFlowV1?color=green" alt="Last Commit" />
</p>

# TabFlow

A full-stack Chrome extension that replaces the browser's native tab switcher with an intelligent, keyboard-driven HUD overlay. Built as a monorepo with a **React 19 extension frontend**, an **Express.js v5 REST API**, **Neon serverless PostgreSQL**, **Gemini AI embeddings** for semantic search, and **AWS Cognito/S3** for auth and storage.

<!-- Add a demo GIF or screenshot here for maximum recruiter impact -->
<!-- ![TabFlow Demo](docs/demo.gif) -->

---

## Why TabFlow?

Power users juggle dozens of tabs across multiple windows. The native Chrome tab bar doesn't scale — tabs shrink to unreadable slivers, and Ctrl+Tab cycles linearly instead of by recency. TabFlow solves this with:

- **MRU-first navigation** - tabs sorted by last access, not position
- **Full-screen grid overlay** - inspired by Windows Alt+Tab, with visual thumbnails
- **Fuzzy + semantic search** - find tabs by memory, not by hunting through a bar
- **Cloud-synced workspaces** - save and restore tab sets across devices
- **Zero-config analytics** - passive browsing insights without any setup

---

## Features

### Core Tab Management
- Full-screen HUD overlay triggered by `Alt+Q` with blur backdrop and stagger animation
- Most Recently Used (MRU) ordering tracked by a persistent background service worker
- Fuzzy search across titles, URLs, and notes (Fuse.js, configurable threshold)
- Structured filters: `is:pinned`, `is:audible`, `is:duplicate`, `domain:github.com`
- 2D arrow-key grid navigation with Enter to switch, Backspace to close
- Drag-to-reorder, multi-select (Ctrl+Click / Shift+Click), bulk operations
- Tab group support with colored card stripes and automatic group suggestions
- Duplicate detection, quick-switch (double-tap `Alt+Q`), tab thumbnails (LRU cache)

### AI-Powered Semantic Search
- Type `ai: describe what you're looking for` to search by meaning, not keywords
- Gemini `gemini-embedding-001` generates 768-dimensional embeddings per tab
- pgvector cosine similarity search over both open and historical tabs
- Graceful fallback with loading, error, and empty-state feedback

### Workspaces
- Save, restore, update, and delete named tab sets
- Synced to cloud via REST API under authenticated user accounts
- Filtered of restricted URLs on restore

### Additional Capabilities
- **Snooze** — defer tabs for 30 min to 1 week; `chrome.alarms` handles wake events
- **Notes** — attach text notes to any URL via the command palette
- **Analytics** — passive visit tracking with top-sites bar chart in the HUD
- **Tab Suspender** — auto-discard inactive tabs to reclaim memory (skips pinned/active/audible)
- **Command Palette** — type `>` for bulk operations (close dupes, group tabs, cycle sort)
- **Context Menu** — right-click for pin, duplicate, move-to-window, reload, close
- **Recently Closed** — restore from the 10 most recent closed tabs
- **Keyboard Cheat Sheet** — press `?` for a reference modal

---

## Tech Stack

### Extension (`apps/extension/`)

| Technology | Purpose |
|---|---|
| **WXT 0.19** | Manifest V3 framework — shadow DOM mounting, HMR dev server |
| **React 19** | HUD overlay UI (injected via content script) |
| **TypeScript 5.6** | End-to-end type safety |
| **Tailwind CSS 3.4** | Utility-first styling scoped to shadow DOM |
| **Fuse.js 7** | Weighted fuzzy search (title, URL, notes) |
| **Chrome APIs** | tabs, tabGroups, sessions, storage, alarms, identity, captureVisibleTab |

### API (`apps/api/`)

| Technology | Purpose |
|---|---|
| **Express.js 5** | REST API server |
| **TypeScript 5.7** | Shared type safety with the extension |
| **Drizzle ORM** | Type-safe SQL queries and schema migrations |
| **postgres.js 3** | PostgreSQL driver (SSL required for Neon serverless) |
| **Zod** | Runtime request validation |
| **express-jwt + jwks-rsa** | Cognito JWT verification via JWKS rotation |

### Infrastructure

| Service | Purpose |
|---|---|
| **Neon** | Serverless PostgreSQL — workspaces, embeddings, analytics, notes |
| **pgvector** | 768-dim cosine similarity index for semantic search |
| **AWS Cognito** | OAuth 2.0 Authorization Code + PKCE |
| **AWS S3** | Tab screenshot storage with presigned URLs |
| **AWS App Runner** | Containerized API deployment with auto-scaling |
| **Google Gemini** | Embedding model for semantic tab search |

---

## Database Schema

| Table | Description |
|---|---|
| `users` | Cognito sub + email, created on first sign-in |
| `workspaces` | Named tab sets (JSONB array of url/title/favicon) |
| `bookmarks` | Cloud-synced bookmarks with favicon |
| `notes` | Per-URL text notes |
| `tab_embeddings` | 768-dim Gemini vectors for semantic search |
| `tab_analytics` | Per-URL visit count and total duration |
| `user_settings` | JSONB settings blob, upserted on change |

---

## API Endpoints

All endpoints require `Authorization: Bearer <cognito-token>` or `x-device-id` header.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/api/auth/token` | Exchange Cognito auth code for tokens |
| `GET` | `/api/sync/workspaces` | List saved workspaces |
| `POST` | `/api/sync/workspaces` | Create workspace |
| `PATCH` | `/api/sync/workspaces/:id` | Update workspace |
| `DELETE` | `/api/sync/workspaces/:id` | Delete workspace |
| `POST` | `/api/sync/bookmarks` | Sync bookmark |
| `POST` | `/api/sync/notes` | Sync note |
| `PUT` | `/api/sync/settings` | Upsert settings |
| `POST` | `/api/ai/embed` | Generate + store embedding |
| `GET` | `/api/ai/history?q=` | Semantic search over embeddings |
| `POST` | `/api/analytics/visit` | Record tab visit |
| `GET` | `/api/analytics/top-domains` | Top domains by visits/time |
| `POST` | `/api/thumbnails/upload` | Presigned S3 upload URL |
| `GET` | `/api/thumbnails/:tabId` | Presigned S3 download URL |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+ (`npm install -g pnpm`)
- Chrome or Chromium-based browser
- Neon PostgreSQL database (free tier works)
- (Optional) AWS account for Cognito + S3
- (Optional) Google Cloud project with Gemini API enabled

### Installation

```bash
# Clone and install
git clone https://github.com/danielzhao07/TabFlowV1.git
cd TabFlowV1
pnpm install

# Configure API environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database URL, API keys, etc.

# Push database schema
cd apps/api && pnpm drizzle-kit push && cd ../..

# Build the extension
pnpm build
```

### Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `apps/extension/.output/chrome-mv3`

### Development

```bash
# Extension dev server with HMR
pnpm dev

# API dev server (tsx watch)
pnpm dev:api

# Run both concurrently
pnpm dev:all
```

---

## Usage

| Action | Shortcut |
|---|---|
| Open / close HUD | `Alt+Q` / `Esc` |
| Navigate grid | Arrow keys |
| Switch to tab | `Enter` or click |
| Close tab | `Backspace` or `X` |
| Search | Type in bottom search bar |
| AI search | `ai: your query` |
| Command palette | `>` prefix |
| Multi-select | `Ctrl+Click` / `Shift+Click` |
| Quick-switch | Double-tap `Alt+Q` |
| Cheat sheet | `?` |

---

## License

This project is licensed under the [MIT License](LICENSE).
