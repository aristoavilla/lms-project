# Saint Lucia School LMS (Portfolio)

Single-school class-based LMS aligned to the provided PRD.

## Stack

- Frontend: React + Vite + TypeScript
- Data layer in UI runtime: React Query + Convex-backed service adapter with local fallback (`packages/frontend/src/services/lmsService.ts`)
- Backend model and RBAC rules: Convex functions under `packages/backend/convex/`

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
- Convex server-side checks in:
  - `packages/backend/convex/lib/rbac.ts`
  - `packages/backend/convex/assignments.ts`
  - `packages/backend/convex/attendance.ts`
  - `packages/backend/convex/announcements.ts`
  - `packages/backend/convex/rankings.ts`
  - `packages/backend/convex/users.ts`

Key guarantees currently enforced in Convex layer:

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

To enable Convex-backed runtime data, configure:

```bash
# .env.local
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
```

If `VITE_CONVEX_URL` is not set, the app falls back to local seeded service behavior.
When `VITE_CONVEX_URL` is configured, write operations require Convex availability and will fail explicitly instead of silently saving to temporary local state.

## Validate

```bash
pnpm lint
pnpm build
pnpm test
```

## Current Phase Notes

- Runtime data supports Convex-backed reads/writes for core LMS flows and chat.
- Convex bootstrap seeding is non-destructive and only runs on empty deployments.
- Multi-class (9 classes x 30 students) full production dataset and migration are not yet implemented.
- Quiz auto-grading/manual grading flow is partially modeled but not fully surfaced as an end-to-end UI workflow.
