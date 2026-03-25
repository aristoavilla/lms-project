# Queue Implementation Errors & Fixes

## Context

The app uses a Cloudflare Queue (`lms-events`) for two things:
- Async PostHog analytics (every API request)
- Async notification persistence (LMS actions like grading, assignments, etc.)

---

## Errors Found

### 1. PostHog queue messages missing `type` field — FIXED
**File:** `packages/backend/src/lib/posthog.ts`

`queuePosthogEvent()` sent messages as `{ event, distinctId, properties }` with no `type` field.
The consumer in `queueConsumer.ts` checks `body.type === "notification"` to distinguish message kinds —
anything without `type` is implicitly treated as a PostHog event. This worked by convention but
was fragile; a future message type without `type` would be silently misrouted to PostHog.

**Fix:** Added `type: "posthog"` to all outgoing PostHog queue messages.

---

### 2. `/events` route had no authentication — FIXED
**File:** `packages/backend/src/routes/queue.ts`

The `POST /events` endpoint sent arbitrary events directly to the queue with no auth check.
Anyone who knew the URL could spam the queue with garbage, exhaust batch limits, and flood
the PostHog consumer with junk events.

**Fix:** Added JWT bearer token verification. Unauthenticated requests now get a `401`.

---

### 3. Queue consumer has no retry limit configured — FIXED
**File:** `packages/backend/wrangler.toml`

The `[[queues.consumers]]` block had no `max_retries` set, so Cloudflare defaults to 3 retries.
This is fine but implicit — a consumer crash (e.g., DB connection error) would silently retry
with no visibility.

**Fix:** Added explicit `max_retries = 3` to make the behaviour intentional and documented.

---

### 4. No dead-letter queue — FIXED
**File:** `packages/backend/wrangler.toml`

If the consumer exhausts all retries, messages are permanently lost with no way to replay them.
A dead-letter queue (DLQ) would catch these failed messages.

**Fix:** Queue `lms-events-dlq` created in Cloudflare dashboard and `dead_letter_queue = "lms-events-dlq"`
added to `[[queues.consumers]]` in `wrangler.toml`. Failed messages after 3 retries now land in the DLQ
for inspection and replay.

---

### 5. Queue consumer does not run in local dev — KNOWN LIMITATION (not fixable)

Wrangler's local dev mode (`wrangler dev`) accepts queue sends from the producer but **never
invokes the consumer**. This means:
- Notifications enqueued locally are never persisted to DB
- PostHog events enqueued locally are never forwarded

This is a Cloudflare/Wrangler limitation. To test the full queue flow, deploy to a Cloudflare
Workers environment and use `wrangler tail` to observe consumer invocations.
