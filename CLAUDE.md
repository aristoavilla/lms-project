# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saint Lucia School LMS — a portfolio project. pnpm monorepo with two packages:
- `packages/frontend` — React 19 + Vite SPA, deployed to Vercel
- `packages/backend` — Hono API on Cloudflare Workers, deployed via Wrangler

## Commands

### Development
```bash
pnpm dev                          # Start frontend dev server
pnpm dev:frontend                 # Frontend explicitly (Vite, port 5173)
pnpm dev:backend                  # Backend explicitly (Wrangler, port 8787)
```

### Build & Type Check
```bash
pnpm build                        # Build both packages
pnpm lint                         # ESLint (frontend only)
pnpm --dir packages/backend typecheck  # Backend type check
```

### Testing
```bash
pnpm test                         # Run frontend tests (vitest)
pnpm --dir packages/frontend test # Same, explicit path
```

### Database
```bash
pnpm db:generate                  # Generate Drizzle migration files
pnpm db:migrate                   # Apply migrations to Neon DB
pnpm --dir packages/backend seed:json:generate  # Generate seed JSON
```

### Backend Deploy
```bash
pnpm --dir packages/backend deploy  # Deploy to Cloudflare Workers
```

## Environment Setup

**Backend** — copy and fill `.dev.vars`:
```bash
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
# Set: DATABASE_URL, JWT_SECRET, POSTHOG_API_KEY, POSTHOG_HOST
```

**Frontend** — create `.env.local`:
```
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_PUBLIC_POSTHOG_KEY=phc_xxxxx
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
VITE_PUBLIC_OTEL_LOGS_ENABLED=true
VITE_PUBLIC_OTEL_LOGS_ENDPOINT=
VITE_PUBLIC_OTEL_SERVICE_NAME=lms-frontend
```

## Architecture

### Backend (`packages/backend/src/`)
- **Entry**: `index.ts` — Hono app with CORS, logging middleware, PostHog request analytics, and Cloudflare Queue consumer
- **Routes**: `routes/auth.ts`, `routes/lms.ts`, `routes/storage.ts`, `routes/queue.ts`, `routes/notifications.ts`
- **Database**: Drizzle ORM + Neon serverless PostgreSQL. Schema at `db/schema.ts`, client at `db/client.ts`
- **Auth**: JWT via `jose`, tokens validated in middleware. Secret from `JWT_SECRET` env var
- **Queue**: Cloudflare Queues (binding: `LMS_QUEUE`) used for async PostHog events and notifications. Consumer handles batch processing in `index.ts`
- **Storage**: Cloudflare R2 (binding: `LMS_UPLOADS`) for file uploads/downloads

### Frontend (`packages/frontend/src/`)
- **Entry**: `main.tsx` — MUI theme (teal primary `#0f766e`), React Query (30s stale time, no window focus refetch), PostHog init
- **Routing**: `App.tsx` — React Router v7 with session bootstrap from localStorage (`lms:session:token`, `lms:session:user`)
- **API Layer**: `services/backend/` — modular files (`auth.ts`, `academics.ts`, `admin.ts`, `announcements.ts`, `chat.ts`, `notifications.ts`, `profile.ts`, `users.ts`) re-exported from `lmsService.backend.ts`. All calls use `Authorization: Bearer <token>` header
- **Feature Flags**: PostHog client-side flags. `feedback_page_access` flag gates the `/feedback` route
- **State**: TanStack Query for server state; React Hook Form for forms; no global client state store

### User Roles
`super_admin` | `main_teacher` | `specialized_teacher` | `administrative_student` | `regular_student`

Role checks happen both in frontend routing (conditional rendering) and backend route handlers.

### Key Domain Entities
`users` → `classes` → `subjects` → `assignments` → `submissions`
`attendance`, `announcements`, `chats` / `messages`, `notifications`, `rankings`

## Deployment
- **Frontend**: Vercel — root dir `packages/frontend`, `vercel.json` handles SPA rewrite (`/* → /index.html`)
- **Backend**: Cloudflare Workers — `wrangler.toml` at `packages/backend/`
- Both can be deployed independently

## Feature Flag: Feedback Page
Create a boolean flag named `feedback_page_access` in PostHog. The frontend reads this flag post-login and conditionally shows the `/feedback` route. Supports percentage rollout or user-property targeting.
