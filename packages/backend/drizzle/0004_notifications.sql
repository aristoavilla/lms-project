CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY,
	"recipient_external_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text NOT NULL,
	"resource_id" text,
	"resource_type" text,
	"actor_name" text,
	"read" boolean NOT NULL DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "notifications"("recipient_external_id");
