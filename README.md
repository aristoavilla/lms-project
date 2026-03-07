# Saint Lucia School LMS (Portfolio)

Single-school class-based LMS aligned to the provided PRD.

## Stack

- Frontend: React + Vite + TypeScript
- Data layer in UI runtime: React Query + Convex-backed service adapter with local fallback (`src/services/lmsService.ts`)
- Backend model and RBAC rules: Convex functions under `convex/`

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

- Frontend service-level role checks in `src/services/lmsService.ts`
- Convex server-side checks in:
  - `convex/lib/rbac.ts`
  - `convex/assignments.ts`
  - `convex/attendance.ts`
  - `convex/announcements.ts`
  - `convex/rankings.ts`
  - `convex/users.ts`

Key guarantees currently enforced in Convex layer:

- Approved-user gating
- Subject must belong to requester class
- Specialized teacher can only act on owned subject
- Main/specialized teacher actions requiring subject ownership
- Announcements and user listing constrained to class scope
- Students blocked from ranking endpoints

## Run

```bash
npm install
npm run dev
```

To enable Convex-backed runtime data, configure:

```bash
# .env.local
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
```

If `VITE_CONVEX_URL` is not set (or a Convex call fails), the app safely falls back to local seeded service behavior.

## Validate

```bash
npm run lint
npm run build
npm run test
```

## Current Phase Notes

- Runtime data now supports Convex-backed reads/writes for core LMS flows (users, assignments, announcements, attendance, submissions, rankings, admin actions), with local fallback for resiliency.
- Chat remains local-service backed in this phase.
- Multi-class (9 classes x 30 students) full production dataset and migration are not yet implemented.
- Quiz auto-grading/manual grading flow is partially modeled but not fully surfaced as an end-to-end UI workflow.
