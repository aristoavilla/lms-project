# QA Review Checklist

Reviewed against: `Lms Prd Single School Class Portfolio (2).docx` (attached PRD)

## Functionality
Status: NOT OK

- `convex/assignments.ts:5-13` `listBySubject` allows any approved user to query any `subjectId` without class/subject ownership validation.
- `convex/assignments.ts:16-42` assignment creation only checks role and does not verify subject ownership (`specialized_teacher` can create for subjects they do not own).
- `convex/assignments.ts:45-94` submission flow validates role but does not verify student-class relation to assignment subject/class.
- `convex/attendance.ts:15-19` specialized teacher attendance listing trusts caller-provided `subjectId` and does not verify ownership.
- `convex/attendance.ts:25-44` attendance marking lacks subject ownership check for specialized teachers.
- `convex/announcements.ts:5-13` announcement listing allows approved users to fetch announcements for arbitrary `classId`.
- `convex/rankings.ts:18-79` subject ranking blocks students but does not restrict specialized teachers to their own subject.
- `src/services/lmsService.ts:191-194` main teacher can grade any subject submission, while PRD says teachers grade/comment only if subject owner.

## Completeness
Status: NOT OK

- PRD requires Convex-backed auth/DB/permission validation, but runtime app path is still local in-memory service (`src/App.tsx:13`, `src/services/lmsService.ts:20-23`) instead of using Convex endpoints.
- PRD authentication requirements (email/password + OAuth + self-registration + persistent login) are not implemented in runtime flow; login is seeded-user impersonation (`src/pages/LoginPage.tsx`, `src/components/AppLayout.tsx:32-44`).
- PRD portfolio scope defines 9 classes with 30 students each; current seeded data is minimal and single-class demo only (`src/data/seed.ts:21-92`).
- PRD quiz/assessment behavior (MC auto-grading + essay manual grading) is not implemented end-to-end in current UI/service flow.

## Consistency
Status: PARTIAL

- Schema/type ID modeling is inconsistent: Convex schema uses many plain strings for relational IDs (`convex/schema.ts:16,26,36,37,44,63-65,74,78`) while other fields use `v.id(...)`, increasing mismatch risk.
- Repository documentation is not project-specific and still template-level (`README.md:1-73`).

## Clarity
Status: PARTIAL

- Project currently mixes two architectural paths (Convex server files and separate in-memory frontend service), making intended source of truth unclear (`convex/*` vs `src/services/lmsService.ts`).
- `src/hooks/useLmsQueries.ts:12-16` exposes all users globally in UI state without role-scoped filtering, which complicates secure-by-default design.

## Guesswork
Status: NOT OK

- Multiple authorization-sensitive queries/mutations rely on caller-provided `classId`/`subjectId` instead of deriving authorized scope from server-side ownership (`convex/announcements.ts:6-13`, `convex/attendance.ts:6-19`, `convex/assignments.ts:6-13`).
- `requireApprovedUser` uses `userId: string` plus `as never` casting in DB access (`convex/lib/rbac.ts:10-15`), masking type safety issues.

## Documentation
Status: NOT OK

- Documentation does not currently explain implemented LMS architecture, RBAC boundaries, setup, known gaps, or phase status versus PRD.

## Testing
Status: NOT OK

- Test scope is narrow: only ranking utility tests and two assignment submission negative cases (`src/utils/ranking.test.ts`, `src/services/lmsService.test.ts`).
- No targeted tests for PRD-critical security behaviors (subject ownership, class-scoped visibility, ranking access restrictions, approval gating).
- `npm run test` could not be fully validated in this environment due `spawn EPERM` while loading `vite.config.ts`.

## Other
Status: PARTIAL

- Demo user switcher in topbar enables direct role impersonation at runtime (`src/components/AppLayout.tsx:32-44`); useful for demos, but blocks production-grade QA sign-off.

## Review
Most likely code-review flags:

- Missing backend ownership checks on RBAC-critical endpoints.
- Gap between PRD-required Convex architecture and active in-memory runtime implementation.
- Insufficient tests around permission and data-isolation boundaries.
- Missing project-specific technical documentation.

## Suggestions

- Centralize server-side authorization helpers for class and subject ownership; enforce them in every Convex query/mutation.
- Add integration tests that mirror PRD role-capability matrix and class isolation rules.
- Replace template README with project-specific docs: architecture, setup, role matrix, endpoint guarantees, and known phase gaps.

---

## Developer Remediation Update (2026-02-26)

Implemented in this iteration:

- Hardened Convex RBAC and ownership checks:
  - `convex/lib/rbac.ts`: replaced unsafe `string` + cast for user lookup with typed `Id<"users">`; added reusable `requireSubjectInClass` and `requireSubjectOwner`.
  - `convex/assignments.ts`: enforced class-bound subject access, subject-owner-only assignment creation, semester existence check, and student class check on submission.
  - `convex/attendance.ts`: enforced specialized-teacher subject requirement + ownership checks, class-bound subject validation, and student/semester validation on attendance marking.
  - `convex/announcements.ts`: blocked cross-class announcement read/create by validating requester class.
  - `convex/rankings.ts`: blocked specialized teachers from ranking access outside owned subjects.
  - `convex/users.ts`: main teachers can list users only in their own class.
- Improved schema consistency for relational IDs:
  - `convex/schema.ts` updated major relationship fields to `v.id(...)` instead of free-form strings.
- Tightened runtime service rule flagged by reviewer:
  - `src/services/lmsService.ts`: grading now requires subject ownership (main/specialized teacher must be assigned subject owner); submission now validates assignment class scope.
- Expanded tests for security-sensitive behaviors:
  - `src/services/lmsService.test.ts`: added cases for class isolation, non-owner grading block, specialized-teacher ranking restriction, and subject-scoped attendance visibility.
- Replaced template docs with project-specific documentation:
  - `README.md` now documents architecture, RBAC boundaries, setup, validation commands, and current known phase gaps.

Validation:

- `npm run lint`: passed
- `npm run test`: passed (`8` tests)
- `npm run build`: passed

Still pending for full PRD parity (tracked and documented):

- Runtime app still uses local seeded service for active UI data flow; full Convex auth/runtime wiring remains a separate phase.
- PRD auth requirements (email/password + OAuth + registration + persistent session) are not yet implemented end-to-end in the UI.
- Full 9-classes x 30-students production dataset and complete quiz auto/manual grading UX remain pending.
