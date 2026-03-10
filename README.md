# Saint Lucia School LMS (Portfolio)

Single-school class-based LMS aligned to the provided PRD.

## Stack

- Frontend: React + Vite + TypeScript + MUI + React Query
- Backend API: Cloudflare Workers + Hono + TypeScript
- Database and auth store: Neon (PostgreSQL) + Drizzle ORM
- Cloud services: Cloudflare R2 (object storage) + Cloudflare Queues
- Monitoring: PostHog (queued capture from backend, optional browser capture)

## Implemented PRD Areas

- Role-aware dashboard and pages for:
  - Assignments
  - Subject detail (grades + attendance)
  - Rankings (role-conditional)
  - Attendance
  - Announcements
  - Super admin actions
- Core LMS domain model: users, classes, subjects, semesters, assignments, submissions, attendance, announcements
- Ranking algorithm with tie-breaker support
- Assignment submission rules:
  - Late submission checks
  - Resubmission policy checks
  - Class-scope checks
- Announcement ownership checks for edit/delete
- Expanded ownership checks in Convex endpoints (subject owner and class boundary enforcement)

## Security Model (Current)

- Frontend service-level role checks in `packages/frontend/src/services/lmsService.ts`
- Backend API foundation in:
  - `packages/backend/src/routes/auth.ts`
  - `packages/backend/src/routes/storage.ts`
  - `packages/backend/src/routes/queue.ts`
  - `packages/backend/src/workers/queueConsumer.ts`

Key guarantees currently enforced in frontend/local service layer:

- Approved-user gating
- Subject must belong to requester class
- Specialized teacher can only act on owned subject
- Main/specialized teacher actions requiring subject ownership
- Announcements and user listing constrained to class scope
- Students blocked from ranking endpoints

## Run

```bash
pnpm install
pnpm dev
```

Run frontend and backend separately when needed:

```bash
pnpm dev:frontend
pnpm dev:backend
```

Backend local environment setup:

```bash
cp packages/backend/.dev.vars.example packages/backend/.dev.vars
# Fill DATABASE_URL, JWT_SECRET, and optional PostHog values.
```

Frontend optional PostHog environment setup:

```bash
# packages/frontend/.env.local
VITE_PUBLIC_POSTHOG_KEY=phc_xxxxx
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Frontend API setup for Worker-backed auth:

```bash
# packages/frontend/.env.local
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## Deploy Frontend To Vercel

This monorepo is configured so the frontend can be deployed from `packages/frontend`.

1. Import the GitHub repository in Vercel.
2. In project settings, set `Root Directory` to `packages/frontend`.
3. Keep build settings aligned with `packages/frontend/vercel.json`:
  - Install Command: `pnpm install --frozen-lockfile`
  - Build Command: `pnpm build`
  - Output Directory: `dist`
4. Add required environment variables in Vercel:
  - `VITE_API_BASE_URL` (your deployed backend base URL)
  - `VITE_PUBLIC_POSTHOG_KEY` (optional)
  - `VITE_PUBLIC_POSTHOG_HOST` (optional, defaults in app)

The included Vercel rewrite rule routes SPA paths to `index.html` so deep links work correctly.

Current frontend runtime uses the Neon-backed backend API adapter for LMS data and auth sessions.

## Validate

```bash
pnpm lint
pnpm build
pnpm test
pnpm --dir packages/backend typecheck
```

## Current Phase Notes

- Runtime data is served via backend LMS endpoints connected to NeonDB for users, classes, subjects, assignments, submissions, attendance, announcements, chats, and rankings.
- Backend stack migration baseline is complete for auth, storage, queue, and monitoring plumbing.
- Multi-class (9 classes x 30 students) full production dataset and migration are not yet implemented.
- Quiz auto-grading/manual grading flow is partially modeled but not fully surfaced as an end-to-end UI workflow.
