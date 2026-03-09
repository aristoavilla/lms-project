CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by_external_id" text NOT NULL,
	"attachment" text,
	"scheduled_at" text,
	"created_at" text NOT NULL,
	"class_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"class_id" text NOT NULL,
	"semester_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"deadline" text NOT NULL,
	"allow_late" boolean DEFAULT false NOT NULL,
	"allow_resubmit" boolean DEFAULT false NOT NULL,
	"total_score" integer NOT NULL,
	"created_by_external_id" text NOT NULL,
	"assignment_type" text NOT NULL,
	"attachment_ids" jsonb
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"class_id" text NOT NULL,
	"semester_id" text NOT NULL,
	"student_external_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text,
	"participant_external_ids" jsonb,
	"last_message_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"main_teacher_external_id" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"sender_external_id" text NOT NULL,
	"content" text NOT NULL,
	"attachment" text,
	"created_at" text NOT NULL,
	"edited_at" text,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"teacher_external_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"class_id" text NOT NULL,
	"teacher_external_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"student_external_id" text NOT NULL,
	"submission_type" text NOT NULL,
	"payload" text NOT NULL,
	"score" integer,
	"comment" text,
	"submitted_at" text NOT NULL,
	"late" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "taught_class_ids" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_external_id_unique" UNIQUE("external_id");