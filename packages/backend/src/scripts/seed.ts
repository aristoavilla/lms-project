import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  announcements,
  assignments,
  attendance,
  chats,
  classes,
  messages,
  semesters,
  subjectTeachers,
  subjects,
  submissions,
  users,
} from "../db/schema";
import { loadBackendEnv } from "../lib/nodeEnv";

loadBackendEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

interface ConvexSeed {
  classes?: Array<{ externalId: string; name: string; mainTeacherExternalId?: string }>;
  semesters?: Array<{ externalId: string; name: string; startDate: string; endDate: string }>;
  users?: Array<{
    externalId: string;
    name: string;
    email: string;
    password?: string;
    role: string;
    approved: boolean;
    externalClassId: string;
    bio?: string;
    externalSubjectId?: string;
    externalTaughtClassIds?: string[];
  }>;
  subjects?: Array<{
    externalId: string;
    name: string;
    externalClassId: string;
    externalTeacherId?: string;
    primaryTeacherExternalId?: string;
  }>;
  subjectTeachers?: Array<{
    externalId: string;
    externalClassId: string;
    externalSubjectId: string;
    externalTeacherId: string;
  }>;
  assignments?: Array<{
    externalId: string;
    externalSubjectId: string;
    externalClassId: string;
    externalSemesterId: string;
    title: string;
    description: string;
    deadline: string;
    allowLate: boolean;
    allowResubmit: boolean;
    totalScore: number;
    externalCreatedBy: string;
    assignmentType?: string;
    attachmentStorageIds?: string[];
  }>;
  submissions?: Array<{
    externalId: string;
    externalAssignmentId: string;
    externalStudentId: string;
    submissionType?: string;
    payload?: string;
    score?: number;
    comment?: string;
    submittedAt: string;
    late: boolean;
  }>;
  attendance?: Array<{
    externalId: string;
    externalSubjectId: string;
    externalClassId: string;
    externalSemesterId: string;
    externalStudentId: string;
    date: string;
    status: string;
  }>;
  announcements?: Array<{
    externalId: string;
    title: string;
    content: string;
    externalCreatedBy: string;
    externalAttachment?: string;
    scheduledAt?: string;
    createdAt: string;
    externalClassId: string;
  }>;
  chats?: Array<{
    externalId: string;
    type: string;
    externalClassId: string;
    externalSubjectId?: string;
    externalParticipantIds?: string[];
    lastMessageAt?: string;
    createdAt: string;
  }>;
  messages?: Array<{
    externalId: string;
    externalChatId: string;
    externalSenderId: string;
    content: string;
    externalAttachment?: string;
    createdAt: string;
    editedAt?: string;
    deleted: boolean;
  }>;
}

function readSeedFile() {
  const seedPath = resolve(process.cwd(), "seed", "convex-seed.json");
  const raw = readFileSync(seedPath, "utf8");
  return JSON.parse(raw) as ConvexSeed;
}

async function main() {
  const seed = readSeedFile();

  await sql`
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
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "notifications_recipient_idx"
    ON "notifications"("recipient_external_id");
  `;

  if (seed.classes?.length) {
    await db.insert(classes).values(
      seed.classes.map((row) => ({
        id: row.externalId,
        name: row.name,
        mainTeacherExternalId: row.mainTeacherExternalId,
      })),
    ).onConflictDoNothing({ target: classes.id });
  }

  if (seed.semesters?.length) {
    await db.insert(semesters).values(
      seed.semesters.map((row) => ({
        id: row.externalId,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
      })),
    ).onConflictDoNothing({ target: semesters.id });
  }

  if (seed.users?.length) {
    await db.insert(users).values(
      seed.users.map((row) => ({
        externalId: row.externalId,
        email: row.email,
        name: row.name,
        passwordHash: row.password ?? "Password123!",
        role: row.role,
        approved: row.approved,
        classId: row.externalClassId,
        bio: row.bio,
        subjectId: row.externalSubjectId,
        taughtClassIds: row.externalTaughtClassIds,
      })),
    ).onConflictDoNothing({ target: users.externalId });
  }

  if (seed.subjects?.length) {
    await db.insert(subjects).values(
      seed.subjects.map((row) => ({
        id: row.externalId,
        name: row.name,
        classId: row.externalClassId,
        teacherExternalId: row.externalTeacherId ?? row.primaryTeacherExternalId ?? "u-super-1",
      })),
    ).onConflictDoNothing({ target: subjects.id });
  }

  if (seed.subjectTeachers?.length) {
    await db.insert(subjectTeachers).values(
      seed.subjectTeachers.map((row) => ({
        id: row.externalId,
        classId: row.externalClassId,
        subjectId: row.externalSubjectId,
        teacherExternalId: row.externalTeacherId,
      })),
    ).onConflictDoNothing({ target: subjectTeachers.id });
  }

  if (seed.assignments?.length) {
    await db.insert(assignments).values(
      seed.assignments.map((row) => ({
        id: row.externalId,
        subjectId: row.externalSubjectId,
        classId: row.externalClassId,
        semesterId: row.externalSemesterId,
        title: row.title,
        description: row.description,
        deadline: row.deadline,
        allowLate: row.allowLate,
        allowResubmit: row.allowResubmit,
        totalScore: row.totalScore,
        createdByExternalId: row.externalCreatedBy,
        assignmentType: row.assignmentType ?? "text",
        attachmentIds: row.attachmentStorageIds,
      })),
    ).onConflictDoNothing({ target: assignments.id });
  }

  if (seed.submissions?.length) {
    await db.insert(submissions).values(
      seed.submissions.map((row) => ({
        id: row.externalId,
        assignmentId: row.externalAssignmentId,
        studentExternalId: row.externalStudentId,
        submissionType: row.submissionType ?? "text",
        payload: row.payload ?? "",
        score: row.score,
        comment: row.comment,
        submittedAt: row.submittedAt,
        late: row.late,
      })),
    ).onConflictDoNothing({ target: submissions.id });
  }

  if (seed.attendance?.length) {
    await db.insert(attendance).values(
      seed.attendance.map((row) => ({
        id: row.externalId,
        subjectId: row.externalSubjectId,
        classId: row.externalClassId,
        semesterId: row.externalSemesterId,
        studentExternalId: row.externalStudentId,
        date: row.date,
        status: row.status,
      })),
    ).onConflictDoNothing({ target: attendance.id });
  }

  if (seed.announcements?.length) {
    await db.insert(announcements).values(
      seed.announcements.map((row) => ({
        id: row.externalId,
        title: row.title,
        content: row.content,
        createdByExternalId: row.externalCreatedBy,
        attachment: row.externalAttachment,
        scheduledAt: row.scheduledAt,
        createdAt: row.createdAt,
        classId: row.externalClassId,
      })),
    ).onConflictDoNothing({ target: announcements.id });
  }

  if (seed.chats?.length) {
    await db.insert(chats).values(
      seed.chats.map((row) => ({
        id: row.externalId,
        type: row.type,
        classId: row.externalClassId,
        subjectId: row.externalSubjectId,
        participantExternalIds: row.externalParticipantIds,
        lastMessageAt: row.lastMessageAt,
        createdAt: row.createdAt,
      })),
    ).onConflictDoNothing({ target: chats.id });
  }

  if (seed.messages?.length) {
    await db.insert(messages).values(
      seed.messages.map((row) => ({
        id: row.externalId,
        chatId: row.externalChatId,
        senderExternalId: row.externalSenderId,
        content: row.content,
        attachment: row.externalAttachment,
        createdAt: row.createdAt,
        editedAt: row.editedAt,
        deleted: row.deleted,
      })),
    ).onConflictDoNothing({ target: messages.id });
  }

  console.log("Full LMS seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
