# TabFlow Setup Guide

## Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Chrome or Chromium browser

## Extension Setup (Local Development)

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Package as zip
pnpm zip
```

Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/.output/chrome-mv3-dev` (dev) or `apps/extension/.output/chrome-mv3` (build)

## Backend API Setup

### 1. Neon PostgreSQL

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project (choose closest region, e.g. `us-east-2`)
3. Copy the connection string from the dashboard

### 2. Environment Variables

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in your `.env`:
```
DATABASE_URL=postgresql://neondb_owner:<password>@ep-xxx-yyy-123.us-east-2.aws.neon.tech/neondb?sslmode=require
PORT=3001
CORS_ORIGIN=chrome-extension://<your-extension-id>
```

### 3. Push Database Schema

```bash
pnpm dev:api    # verify it starts
cd apps/api && npx drizzle-kit push   # creates tables on Neon
```

### 4. Run the API

```bash
pnpm dev:api
# API runs at http://localhost:3001
# Health check: curl http://localhost:3001/health
```

## Optional: AI Semantic Search

Get a Gemini API key from [aistudio.google.com](https://aistudio.google.com/apikey) and add to `.env`:
```
GEMINI_API_KEY=your-key-here
```

## Optional: AWS Services

For S3 thumbnails and Cognito auth, add to `.env`:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=tabflow-thumbnails
COGNITO_USER_POOL_ID=us-east-1_xxx
COGNITO_CLIENT_ID=your-client-id
```

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Extension dev server (hot reload) |
| `pnpm build` | Extension production build |
| `pnpm dev:api` | API dev server (tsx watch) |
| `pnpm build:api` | API production build (tsc) |
| `pnpm zip` | Package extension as zip |
