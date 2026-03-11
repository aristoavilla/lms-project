import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  announcements,
  assignments,
  attendance,
  chats,
  classes,
  messages,
  subjectTeachers,
  subjects,
  submissions,
  users,
} from "../db/schema";
import type { AppEnv } from "../env";
import { verifyAccessToken } from "../lib/auth";
import { enqueueNotification, enqueueNotifications } from "../lib/notify";

type PublicUser = {
  id: string;
  dbId: string;
  name: string;
  email: string;
  role: string;
  approved: boolean;
  classId: string;
  subjectId?: string;
  taughtClassIds?: string[];
  bio?: string;
  profileImageUrl?: string;
  createdAt?: string;
};

const roleCanViewRanking = new Set(["super_admin", "main_teacher", "specialized_teacher"]);
const roleCanViewOverall = new Set(["super_admin", "main_teacher"]);

function toPublicUser(row: {
  id: string;
  externalId: string | null;
  name: string;
  email: string;
  role: string;
  approved: boolean;
  classId: string;
  subjectId: string | null;
  taughtClassIds: string[] | null;
  bio: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: row.externalId ?? row.id,
    dbId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    approved: row.approved,
    classId: row.classId,
    subjectId: row.subjectId ?? undefined,
    taughtClassIds: row.taughtClassIds ?? undefined,
    bio: row.bio ?? undefined,
    profileImageUrl: row.profileImageUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function isStudentRole(role: string) {
  return role === "regular_student" || role === "administrative_student";
}

function parseAttachment(raw: string | null) {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function getAuthUser(c: { req: { header: (name: string) => string | undefined }; env: AppEnv }) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const payload = await verifyAccessToken(c.env, token);
  const userId = payload.sub;
  if (typeof userId !== "string") {
    return null;
  }

  const db = getDb(c.env);
  const [row] = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return toPublicUser(row);
}

function getTeacherClassIds(user: PublicUser) {
  const ids = user.taughtClassIds ?? [];
  if (ids.length > 0) {
    return ids;
  }
  return [user.classId];
}

function getTeacherOwnSubjectId(user: PublicUser) {
  return user.subjectId;
}

function canAccessClass(user: PublicUser, classId: string) {
  if (user.role === "super_admin") {
    return true;
  }
  if (isStudentRole(user.role)) {
    return user.classId === classId;
  }
  return getTeacherClassIds(user).includes(classId);
}

function rankingSort(
  left: { average: number; earliestSubmissionAt: string; studentName: string },
  right: { average: number; earliestSubmissionAt: string; studentName: string },
) {
  if (right.average !== left.average) {
    return right.average - left.average;
  }
  const dateSort =
    new Date(left.earliestSubmissionAt).getTime() - new Date(right.earliestSubmissionAt).getTime();
  if (dateSort !== 0) {
    return dateSort;
  }
  return left.studentName.localeCompare(right.studentName);
}

const createAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  deadline: z.string().min(1),
  totalScore: z.number().int().positive(),
});

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  attachment: z.string().optional(),
  scheduledAt: z.string().optional(),
});

const submitAssignmentSchema = z.object({
  payload: z.string().min(1),
  submissionType: z.enum(["file", "text", "quiz"]),
});

const gradeSchema = z.object({
  score: z.number().min(0),
  comment: z.string().optional(),
});

const markAttendanceSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  studentId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["Present", "Absent", "Excused"]),
});

const updateProfileSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional().default(""),
  profileImageUrl: z.string().max(5_000_000).nullable().optional(),
});

const sendMessageSchema = z.object({
  chatId: z.string().optional(),
  type: z.enum(["class", "subject", "direct"]),
  classId: z.string().min(1),
  subjectId: z.string().optional(),
  recipientUserId: z.string().optional(),
  content: z.string().default(""),
  attachment: z.any().optional(),
});

const assignRoleSchema = z.object({ role: z.string().min(1) });
const assignTeacherSchema = z.object({ teacherId: z.string().min(1) });

export const lmsRoutes = new Hono<{ Bindings: AppEnv }>();

lmsRoutes.get("/lms/users", async (c) => {
  const db = getDb(c.env);
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rows = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users);

  const mapped = rows.map(toPublicUser);
  if (authUser.role === "super_admin") {
    return c.json({ users: mapped.map(({ dbId, ...rest }) => rest) });
  }

  const visible = mapped
    .filter((user) => user.classId === authUser.classId)
    .map(({ dbId, ...rest }) => rest);
  return c.json({ users: visible });
});

lmsRoutes.get("/lms/classes", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(classes);
  return c.json({
    classes: rows.map((row) => ({
      _id: row.id,
      name: row.name,
      mainTeacherId: row.mainTeacherExternalId ?? "",
    })),
  });
});

lmsRoutes.get("/lms/classes/:classId/subjects", async (c) => {
  const db = getDb(c.env);
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const classId = c.req.param("classId");

  if (classId && !canAccessClass(authUser, classId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = classId
    ? await db.select().from(subjects).where(eq(subjects.classId, classId))
    : await db.select().from(subjects);

  const unique = new Map<string, { _id: string; name: string }>();
  for (const row of rows) {
    if (!unique.has(row.id)) {
      unique.set(row.id, { _id: row.id, name: row.name });
    }
  }

  return c.json({ subjects: [...unique.values()] });
});

lmsRoutes.get("/lms/users/me/assignments", async (c) => {
  const db = getDb(c.env);
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let rows = await db.select().from(assignments);
  if (user.role === "super_admin") {
    return c.json({ assignments: rows.map((row) => ({
      _id: row.id,
      subjectId: row.subjectId,
      classId: row.classId,
      semesterId: row.semesterId,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      allowLate: row.allowLate,
      allowResubmit: row.allowResubmit,
      totalScore: row.totalScore,
      createdBy: row.createdByExternalId,
      assignmentType: row.assignmentType,
      attachments: row.attachmentIds ?? undefined,
    })) });
  }

  if (isStudentRole(user.role)) {
    rows = rows.filter((row) => row.classId === user.classId);
  } else {
    const classIds = getTeacherClassIds(user);
    const subjectId = getTeacherOwnSubjectId(user);
    rows = rows.filter((row) => classIds.includes(row.classId) && (subjectId ? row.subjectId === subjectId : true));
  }

  return c.json({
    assignments: rows.map((row) => ({
      _id: row.id,
      subjectId: row.subjectId,
      classId: row.classId,
      semesterId: row.semesterId,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      allowLate: row.allowLate,
      allowResubmit: row.allowResubmit,
      totalScore: row.totalScore,
      createdBy: row.createdByExternalId,
      assignmentType: row.assignmentType,
      attachments: row.attachmentIds ?? undefined,
    })),
  });
});

lmsRoutes.post("/lms/assignments", async (c) => {
  const parsed = createAssignmentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return c.json({ error: "Only teachers can create assignments." }, 403);
  }

  const payload = parsed.data;
  if (user.subjectId && user.subjectId !== payload.subjectId) {
    return c.json({ error: "Teacher can only create assignment for their own subject." }, 403);
  }
  if (!getTeacherClassIds(user).includes(payload.classId)) {
    return c.json({ error: "Teacher can only create assignment for classes they teach." }, 403);
  }

  const db = getDb(c.env);
  const id = `as-${Date.now()}`;
  const [created] = await db
    .insert(assignments)
    .values({
      id,
      subjectId: payload.subjectId,
      classId: payload.classId,
      semesterId: "semester-1",
      title: payload.title,
      description: payload.description,
      deadline: payload.deadline,
      allowLate: true,
      allowResubmit: true,
      totalScore: payload.totalScore,
      createdByExternalId: user.id,
      assignmentType: "text",
    })
    .returning();

  try {
    const studentRows = await db
      .select({ externalId: users.externalId, id: users.id })
      .from(users)
      .where(
        and(
          eq(users.classId, payload.classId),
          or(eq(users.role, "regular_student"), eq(users.role, "administrative_student")),
          eq(users.approved, true),
        ),
      );
    if (studentRows.length > 0) {
      await enqueueNotifications(
        c.env,
        studentRows.map((r) => ({
          recipientExternalId: r.externalId ?? r.id,
          title: "New Assignment",
          body: `${user.name} posted "${created.title}" – due ${created.deadline}`,
          category: "assignment" as const,
          resourceId: created.id,
          resourceType: "assignment",
          actorName: user.name,
        })),
      );
    }
  } catch (err) {
    console.error("[lms] Failed to queue assignment notifications", err);
  }

  return c.json({
    assignment: {
      _id: created.id,
      subjectId: created.subjectId,
      classId: created.classId,
      semesterId: created.semesterId,
      title: created.title,
      description: created.description,
      deadline: created.deadline,
      allowLate: created.allowLate,
      allowResubmit: created.allowResubmit,
      totalScore: created.totalScore,
      createdBy: created.createdByExternalId,
      assignmentType: created.assignmentType,
      attachments: created.attachmentIds ?? undefined,
    },
  });
});

lmsRoutes.get("/lms/users/me/announcements", async (c) => {
  const db = getDb(c.env);
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rows = user.role === "super_admin"
    ? await db.select().from(announcements).orderBy(desc(announcements.createdAt))
    : await db
        .select()
        .from(announcements)
        .where(eq(announcements.classId, user.classId))
        .orderBy(desc(announcements.createdAt));

  return c.json({
    announcements: rows.map((row) => ({
      _id: row.id,
      title: row.title,
      content: row.content,
      createdBy: row.createdByExternalId,
      attachment: row.attachment ?? undefined,
      scheduledAt: row.scheduledAt ?? undefined,
      createdAt: row.createdAt,
      classId: row.classId,
    })),
  });
});

lmsRoutes.post("/lms/announcements", async (c) => {
  const parsed = createAnnouncementSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!["main_teacher", "specialized_teacher", "administrative_student"].includes(user.role)) {
    return c.json({ error: "Only teachers and admin students can create announcements." }, 403);
  }

  const payload = parsed.data;
  const id = `ann-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const db = getDb(c.env);
  const [created] = await db
    .insert(announcements)
    .values({
      id,
      title: payload.title,
      content: payload.content,
      createdByExternalId: user.id,
      attachment: payload.attachment,
      scheduledAt: payload.scheduledAt,
      createdAt,
      classId: user.classId,
    })
    .returning();

  try {
    const classMembers = await db
      .select({ externalId: users.externalId, id: users.id })
      .from(users)
      .where(and(eq(users.classId, user.classId), eq(users.approved, true)));
    const recipients = classMembers
      .map((m) => m.externalId ?? m.id)
      .filter((id) => id !== user.id);
    if (recipients.length > 0) {
      await enqueueNotifications(
        c.env,
        recipients.map((recipientExternalId) => ({
          recipientExternalId,
          title: "New Announcement",
          body: `${user.name}: ${created.title}`,
          category: "announcement" as const,
          resourceId: created.id,
          resourceType: "announcement",
          actorName: user.name,
        })),
      );
    }
  } catch (err) {
    console.error("[lms] Failed to queue announcement notifications", err);
  }

  return c.json({
    announcement: {
      _id: created.id,
      title: created.title,
      content: created.content,
      createdBy: created.createdByExternalId,
      attachment: created.attachment ?? undefined,
      scheduledAt: created.scheduledAt ?? undefined,
      createdAt: created.createdAt,
      classId: created.classId,
    },
  });
});

lmsRoutes.patch("/lms/announcements/:id", async (c) => {
  const payload = createAnnouncementSchema.partial().safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const id = c.req.param("id");

  const [current] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!current) {
    return c.json({ error: "Announcement not found." }, 404);
  }
  if (current.createdByExternalId !== user.id && user.role !== "super_admin") {
    return c.json({ error: "Only announcement owner can update announcement." }, 403);
  }

  const [updated] = await db
    .update(announcements)
    .set({
      title: payload.data.title ?? current.title,
      content: payload.data.content ?? current.content,
      attachment: payload.data.attachment ?? current.attachment,
      scheduledAt: payload.data.scheduledAt ?? current.scheduledAt,
    })
    .where(eq(announcements.id, id))
    .returning();

  return c.json({
    announcement: {
      _id: updated.id,
      title: updated.title,
      content: updated.content,
      createdBy: updated.createdByExternalId,
      attachment: updated.attachment ?? undefined,
      scheduledAt: updated.scheduledAt ?? undefined,
      createdAt: updated.createdAt,
      classId: updated.classId,
    },
  });
});

lmsRoutes.delete("/lms/announcements/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const id = c.req.param("id");

  const [current] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!current) {
    return c.json({ error: "Announcement not found." }, 404);
  }
  if (current.createdByExternalId !== user.id && user.role !== "super_admin") {
    return c.json({ error: "Only announcement owner can delete announcement." }, 403);
  }

  await db.delete(announcements).where(eq(announcements.id, id));
  return c.body(null, 204);
});

lmsRoutes.post("/lms/assignments/:id/submissions", async (c) => {
  const payload = submitAssignmentSchema.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!isStudentRole(user.role)) {
    return c.json({ error: "Only students can submit assignments." }, 403);
  }

  const db = getDb(c.env);
  const assignmentId = c.req.param("id");
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: "Assignment not found." }, 404);
  }
  if (assignment.classId !== user.classId) {
    return c.json({ error: "Assignment is not available for this student class." }, 403);
  }

  const id = `subm-${Date.now()}`;
  const now = new Date().toISOString();
  const late = new Date(now) > new Date(assignment.deadline);
  if (late && !assignment.allowLate) {
    return c.json({ error: "Late submission is not allowed for this assignment." }, 400);
  }

  const [created] = await db
    .insert(submissions)
    .values({
      id,
      assignmentId,
      studentExternalId: user.id,
      submissionType: payload.data.submissionType,
      payload: payload.data.payload,
      submittedAt: now,
      late,
    })
    .returning();

  try {
    const [subjectRow] = await db
      .select({ teacherExternalId: subjects.teacherExternalId })
      .from(subjects)
      .where(eq(subjects.id, assignment.subjectId))
      .limit(1);
    if (subjectRow?.teacherExternalId) {
      await enqueueNotification(c.env, {
        recipientExternalId: subjectRow.teacherExternalId,
        title: "New Submission",
        body: `${user.name} submitted "${assignment.title}"`,
        category: "submission",
        resourceId: created.id,
        resourceType: "submission",
        actorName: user.name,
      });
    }
  } catch (err) {
    console.error("[lms] Failed to queue submission notification", err);
  }

  return c.json({
    submission: {
      _id: created.id,
      assignmentId: created.assignmentId,
      studentId: created.studentExternalId,
      submissionType: created.submissionType,
      payload: created.payload,
      score: created.score ?? undefined,
      comment: created.comment ?? undefined,
      submittedAt: created.submittedAt,
      late: created.late,
    },
  });
});

lmsRoutes.post("/lms/submissions/:id/grade", async (c) => {
  const payload = gradeSchema.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return c.json({ error: "Only teachers can grade submissions." }, 403);
  }

  const db = getDb(c.env);
  const submissionId = c.req.param("id");
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!submission) {
    return c.json({ error: "Submission not found." }, 404);
  }

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  if (!assignment) {
    return c.json({ error: "Assignment not found." }, 404);
  }

  if (user.subjectId && assignment.subjectId !== user.subjectId) {
    return c.json({ error: "Not authorized to grade this submission." }, 403);
  }
  if (!getTeacherClassIds(user).includes(assignment.classId)) {
    return c.json({ error: "Not authorized to grade this submission." }, 403);
  }

  const [updated] = await db
    .update(submissions)
    .set({ score: Math.round(payload.data.score), comment: payload.data.comment ?? null })
    .where(eq(submissions.id, submissionId))
    .returning();

  try {
    await enqueueNotification(c.env, {
      recipientExternalId: updated.studentExternalId,
      title: "Assignment Graded",
      body: `Your submission for "${assignment.title}" received ${updated.score ?? "?"} / ${assignment.totalScore}`,
      category: "grading",
      resourceId: updated.id,
      resourceType: "submission",
      actorName: user.name,
    });
  } catch (err) {
    console.error("[lms] Failed to queue grading notification", err);
  }

  return c.json({
    submission: {
      _id: updated.id,
      assignmentId: updated.assignmentId,
      studentId: updated.studentExternalId,
      submissionType: updated.submissionType,
      payload: updated.payload,
      score: updated.score ?? undefined,
      comment: updated.comment ?? undefined,
      submittedAt: updated.submittedAt,
      late: updated.late,
    },
  });
});

lmsRoutes.get("/lms/users/me/attendance", async (c) => {
  const db = getDb(c.env);
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let rows = await db.select().from(attendance);
  if (user.role === "super_admin") {
    return c.json({
      attendance: rows.map((row) => ({
        _id: row.id,
        subjectId: row.subjectId,
        classId: row.classId,
        semesterId: row.semesterId,
        studentId: row.studentExternalId,
        date: row.date,
        status: row.status,
      })),
    });
  }

  if (isStudentRole(user.role)) {
    rows = rows.filter((row) => row.studentExternalId === user.id);
  } else {
    const classIds = getTeacherClassIds(user);
    rows = rows.filter((row) => classIds.includes(row.classId) && (user.subjectId ? row.subjectId === user.subjectId : true));
  }

  return c.json({
    attendance: rows.map((row) => ({
      _id: row.id,
      subjectId: row.subjectId,
      classId: row.classId,
      semesterId: row.semesterId,
      studentId: row.studentExternalId,
      date: row.date,
      status: row.status,
    })),
  });
});

lmsRoutes.post("/lms/attendance", async (c) => {
  const payload = markAttendanceSchema.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return c.json({ error: "Only teachers can mark attendance." }, 403);
  }

  if (user.subjectId && user.subjectId !== payload.data.subjectId) {
    return c.json({ error: "Teacher can only mark attendance for their own subject." }, 403);
  }
  if (!getTeacherClassIds(user).includes(payload.data.classId)) {
    return c.json({ error: "Teacher can only mark attendance for classes they teach." }, 403);
  }

  const db = getDb(c.env);
  const id = `att-${Date.now()}-${payload.data.studentId}`;
  const [created] = await db
    .insert(attendance)
    .values({
      id,
      subjectId: payload.data.subjectId,
      classId: payload.data.classId,
      semesterId: "semester-1",
      studentExternalId: payload.data.studentId,
      date: payload.data.date,
      status: payload.data.status,
    })
    .onConflictDoNothing()
    .returning();

  if (created && payload.data.status !== "Present") {
    try {
      await enqueueNotification(c.env, {
        recipientExternalId: payload.data.studentId,
        title: "Attendance Marked",
        body: `You were marked ${payload.data.status} on ${payload.data.date}`,
        category: "attendance",
        resourceId: created.id,
        resourceType: "attendance",
        actorName: user.name,
      });
    } catch (err) {
      console.error("[lms] Failed to queue attendance notification", err);
    }
  }

  return c.json({
    attendance: created
      ? {
          _id: created.id,
          subjectId: created.subjectId,
          classId: created.classId,
          semesterId: created.semesterId,
          studentId: created.studentExternalId,
          date: created.date,
          status: created.status,
        }
      : null,
  });
});

lmsRoutes.get("/lms/rankings/subject", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!roleCanViewRanking.has(user.role)) {
    return c.json({ error: "Ranking is blocked for students." }, 403);
  }

  const subjectId = c.req.query("subjectId");
  const classId = c.req.query("classId");
  if (!subjectId || !classId) {
    return c.json({ error: "subjectId and classId are required." }, 400);
  }

  if (user.role === "specialized_teacher") {
    if (user.subjectId !== subjectId) {
      return c.json({ error: "Specialized teacher can only view their subject ranking." }, 403);
    }
    if (!getTeacherClassIds(user).includes(classId)) {
      return c.json({ error: "Specialized teacher can only view classes they teach." }, 403);
    }
  }

  if (user.role === "main_teacher") {
    const classAllowed = classId === user.classId || getTeacherClassIds(user).includes(classId);
    const subjectAllowed = classId === user.classId ? true : user.subjectId === subjectId;
    if (!classAllowed || !subjectAllowed) {
      return c.json({ error: "Main teacher cannot view this class/subject ranking." }, 403);
    }
  }

  const db = getDb(c.env);
  const [studentRows, assignmentRows, submissionRows] = await Promise.all([
    db
      .select({
        id: users.id,
        externalId: users.externalId,
        name: users.name,
        role: users.role,
        classId: users.classId,
      })
      .from(users)
      .where(and(eq(users.classId, classId), or(eq(users.role, "regular_student"), eq(users.role, "administrative_student")))),
    db
      .select()
      .from(assignments)
      .where(and(eq(assignments.classId, classId), eq(assignments.subjectId, subjectId))),
    db.select().from(submissions),
  ]);

  const studentNameById = new Map<string, string>();
  for (const student of studentRows) {
    studentNameById.set(student.externalId ?? student.id, student.name);
  }

  const assignmentIds = new Set(assignmentRows.map((row) => row.id));
  const aggregation = new Map<string, { total: number; count: number; earliest: string }>();
  for (const row of submissionRows) {
    if (!assignmentIds.has(row.assignmentId) || typeof row.score !== "number") {
      continue;
    }
    const current = aggregation.get(row.studentExternalId);
    if (!current) {
      aggregation.set(row.studentExternalId, {
        total: row.score,
        count: 1,
        earliest: row.submittedAt,
      });
      continue;
    }
    aggregation.set(row.studentExternalId, {
      total: current.total + row.score,
      count: current.count + 1,
      earliest: new Date(row.submittedAt) < new Date(current.earliest) ? row.submittedAt : current.earliest,
    });
  }

  const ranking = [...aggregation.entries()]
    .map(([studentId, data]) => ({
      studentId,
      studentName: studentNameById.get(studentId) ?? "Unknown Student",
      average: Number((data.total / data.count).toFixed(2)),
      earliestSubmissionAt: data.earliest,
    }))
    .sort(rankingSort);

  return c.json({ ranking });
});

lmsRoutes.get("/lms/rankings/overall", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!roleCanViewOverall.has(user.role)) {
    return c.json({ error: "Only Main Teacher can access overall ranking." }, 403);
  }

  const classId = c.req.query("classId") ?? user.classId;
  const db = getDb(c.env);

  const [studentRows, assignmentRows, submissionRows] = await Promise.all([
    db
      .select({
        id: users.id,
        externalId: users.externalId,
        name: users.name,
      })
      .from(users)
      .where(and(eq(users.classId, classId), or(eq(users.role, "regular_student"), eq(users.role, "administrative_student")))),
    db.select().from(assignments).where(eq(assignments.classId, classId)),
    db.select().from(submissions),
  ]);

  const studentNameById = new Map<string, string>();
  for (const student of studentRows) {
    studentNameById.set(student.externalId ?? student.id, student.name);
  }

  const subjectToAssignmentIds = new Map<string, Set<string>>();
  for (const assignment of assignmentRows) {
    const existing = subjectToAssignmentIds.get(assignment.subjectId) ?? new Set<string>();
    existing.add(assignment.id);
    subjectToAssignmentIds.set(assignment.subjectId, existing);
  }

  const studentSubjectAverage = new Map<string, { total: number; count: number; earliest: string }>();
  for (const assignmentIds of subjectToAssignmentIds.values()) {
    const byStudent = new Map<string, { total: number; count: number; earliest: string }>();
    for (const row of submissionRows) {
      if (!assignmentIds.has(row.assignmentId) || typeof row.score !== "number") {
        continue;
      }
      const current = byStudent.get(row.studentExternalId);
      if (!current) {
        byStudent.set(row.studentExternalId, {
          total: row.score,
          count: 1,
          earliest: row.submittedAt,
        });
        continue;
      }
      byStudent.set(row.studentExternalId, {
        total: current.total + row.score,
        count: current.count + 1,
        earliest: new Date(row.submittedAt) < new Date(current.earliest) ? row.submittedAt : current.earliest,
      });
    }

    for (const [studentId, avg] of byStudent.entries()) {
      const subjectAverage = avg.total / avg.count;
      const current = studentSubjectAverage.get(studentId);
      if (!current) {
        studentSubjectAverage.set(studentId, {
          total: subjectAverage,
          count: 1,
          earliest: avg.earliest,
        });
        continue;
      }
      studentSubjectAverage.set(studentId, {
        total: current.total + subjectAverage,
        count: current.count + 1,
        earliest: new Date(avg.earliest) < new Date(current.earliest) ? avg.earliest : current.earliest,
      });
    }
  }

  const ranking = [...studentSubjectAverage.entries()]
    .map(([studentId, value]) => ({
      studentId,
      studentName: studentNameById.get(studentId) ?? "Unknown Student",
      average: Number((value.total / value.count).toFixed(2)),
      earliestSubmissionAt: value.earliest,
    }))
    .sort(rankingSort);

  return c.json({ ranking });
});

lmsRoutes.get("/lms/assignments/:id/submissions", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const assignmentId = c.req.param("id");
  const db = getDb(c.env);

  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment) {
    return c.json({ error: "Assignment not found." }, 404);
  }

  if (isStudentRole(user.role) && assignment.classId !== user.classId) {
    return c.json({ error: "Not authorized to view submissions." }, 403);
  }

  if ((user.role === "main_teacher" || user.role === "specialized_teacher") && !getTeacherClassIds(user).includes(assignment.classId)) {
    return c.json({ error: "Not authorized to view submissions." }, 403);
  }

  const rows = await db.select().from(submissions).where(eq(submissions.assignmentId, assignmentId));
  return c.json({
    submissions: rows.map((row) => ({
      _id: row.id,
      assignmentId: row.assignmentId,
      studentId: row.studentExternalId,
      submissionType: row.submissionType,
      payload: row.payload,
      score: row.score ?? undefined,
      comment: row.comment ?? undefined,
      submittedAt: row.submittedAt,
      late: row.late,
    })),
  });
});

lmsRoutes.get("/lms/users/me/submissions", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rawAssignmentIds = c.req.query("assignmentIds") ?? "";
  const requestedAssignmentIds = Array.from(
    new Set(
      rawAssignmentIds
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (requestedAssignmentIds.length === 0) {
    return c.json({ submissions: [] });
  }

  const db = getDb(c.env);
  const assignmentRows = await db
    .select({ id: assignments.id, classId: assignments.classId })
    .from(assignments)
    .where(inArray(assignments.id, requestedAssignmentIds));

  let allowedAssignments = assignmentRows;
  if (isStudentRole(user.role)) {
    allowedAssignments = assignmentRows.filter((assignment) => assignment.classId === user.classId);
  } else if (user.role === "main_teacher" || user.role === "specialized_teacher") {
    const classIds = new Set(getTeacherClassIds(user));
    allowedAssignments = assignmentRows.filter((assignment) => classIds.has(assignment.classId));
  }

  if (allowedAssignments.length === 0) {
    return c.json({ submissions: [] });
  }

  const allowedAssignmentIds = allowedAssignments.map((assignment) => assignment.id);
  const submissionRows = await db
    .select()
    .from(submissions)
    .where(inArray(submissions.assignmentId, allowedAssignmentIds));

  const visibleRows = isStudentRole(user.role)
    ? submissionRows.filter((submission) => submission.studentExternalId === user.id)
    : submissionRows;

  return c.json({
    submissions: visibleRows.map((row) => ({
      _id: row.id,
      assignmentId: row.assignmentId,
      studentId: row.studentExternalId,
      submissionType: row.submissionType,
      payload: row.payload,
      score: row.score ?? undefined,
      comment: row.comment ?? undefined,
      submittedAt: row.submittedAt,
      late: row.late,
    })),
  });
});

lmsRoutes.get("/lms/submissions/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const id = c.req.param("id");

  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  if (!submission) {
    return c.json({ error: "Submission not found." }, 404);
  }

  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, submission.assignmentId)).limit(1);
  if (!assignment) {
    return c.json({ error: "Assignment not found." }, 404);
  }

  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return c.json({ error: "Only teachers can view submission detail." }, 403);
  }
  if (user.subjectId && user.subjectId !== assignment.subjectId) {
    return c.json({ error: "Not authorized to view this submission." }, 403);
  }
  if (!getTeacherClassIds(user).includes(assignment.classId)) {
    return c.json({ error: "Not authorized to view this submission." }, 403);
  }

  const [studentRow] = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(or(eq(users.externalId, submission.studentExternalId), eq(users.id, submission.studentExternalId)))
    .limit(1);

  return c.json({
    submission: {
      _id: submission.id,
      assignmentId: submission.assignmentId,
      studentId: submission.studentExternalId,
      submissionType: submission.submissionType,
      payload: submission.payload,
      score: submission.score ?? undefined,
      comment: submission.comment ?? undefined,
      submittedAt: submission.submittedAt,
      late: submission.late,
    },
    assignment: {
      _id: assignment.id,
      subjectId: assignment.subjectId,
      classId: assignment.classId,
      semesterId: assignment.semesterId,
      title: assignment.title,
      description: assignment.description,
      deadline: assignment.deadline,
      allowLate: assignment.allowLate,
      allowResubmit: assignment.allowResubmit,
      totalScore: assignment.totalScore,
      createdBy: assignment.createdByExternalId,
      assignmentType: assignment.assignmentType,
      attachments: assignment.attachmentIds ?? undefined,
    },
    student: studentRow ? (({ dbId, ...rest }) => rest)(toPublicUser(studentRow)) : null,
  });
});

lmsRoutes.post("/lms/users/:userId/approve", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (authUser.role !== "super_admin") {
    return c.json({ error: "Only super admin can approve users." }, 403);
  }
  const targetId = c.req.param("userId");
  const db = getDb(c.env);
  await db.update(users).set({ approved: true }).where(or(eq(users.externalId, targetId), eq(users.id, targetId)));
  return c.body(null, 204);
});

lmsRoutes.post("/lms/users/:userId/role", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (authUser.role !== "super_admin") {
    return c.json({ error: "Only super admin can assign roles." }, 403);
  }
  const parsed = assignRoleSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const targetId = c.req.param("userId");
  const db = getDb(c.env);
  await db
    .update(users)
    .set({ role: parsed.data.role })
    .where(or(eq(users.externalId, targetId), eq(users.id, targetId)));
  return c.body(null, 204);
});

lmsRoutes.post("/lms/subjects/:subjectId/teacher", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (authUser.role !== "super_admin") {
    return c.json({ error: "Only super admin can assign subject owners." }, 403);
  }

  const parsed = assignTeacherSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const subjectId = c.req.param("subjectId");
  const db = getDb(c.env);
  const [teacher] = await db
    .select({ externalId: users.externalId, id: users.id })
    .from(users)
    .where(or(eq(users.externalId, parsed.data.teacherId), eq(users.id, parsed.data.teacherId)))
    .limit(1);

  if (!teacher) {
    return c.json({ error: "Teacher not found." }, 404);
  }

  const teacherExternalId = teacher.externalId ?? teacher.id;

  await db
    .update(subjects)
    .set({ teacherExternalId })
    .where(eq(subjects.id, subjectId));

  await db
    .update(users)
    .set({ subjectId })
    .where(eq(users.id, teacher.id));

  await db
    .update(subjectTeachers)
    .set({ teacherExternalId })
    .where(eq(subjectTeachers.subjectId, subjectId));

  return c.body(null, 204);
});

lmsRoutes.get("/lms/profiles", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(authUser.role === "super_admin" ? undefined : and(eq(users.classId, authUser.classId), eq(users.approved, true)));

  const mapped = rows.map((row) => {
    const { dbId, ...publicUser } = toPublicUser(row);
    return publicUser;
  });

  return c.json({ profiles: mapped });
});

lmsRoutes.patch("/lms/users/me/profile", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const parsed = updateProfileSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const db = getDb(c.env);
  const [updated] = await db
    .update(users)
    .set({
      name: parsed.data.name.trim(),
      bio: parsed.data.bio.trim(),
      profileImageUrl:
        parsed.data.profileImageUrl === undefined
          ? authUser.profileImageUrl ?? null
          : parsed.data.profileImageUrl,
    })
    .where(eq(users.id, authUser.dbId))
    .returning({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    });

  const { dbId, ...publicUser } = toPublicUser(updated);
  return c.json({ profile: publicUser });
});

lmsRoutes.get("/lms/chats/threads", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);

  const chatRows = user.role === "super_admin"
    ? await db.select().from(chats)
    : await db
        .select()
        .from(chats)
        .where(
          or(
            eq(chats.classId, user.classId),
            sql`${chats.participantExternalIds} ? ${user.id}`,
          ),
        );

  const threads = chatRows
    .map((chat) => ({
      chat: {
        _id: chat.id,
        type: chat.type as "class" | "subject" | "direct",
        classId: chat.classId,
        subjectId: chat.subjectId ?? undefined,
        participantIds: chat.participantExternalIds ?? undefined,
        lastMessageAt: chat.lastMessageAt ?? undefined,
        createdAt: chat.createdAt,
      },
      title: chat.type === "direct" ? "Direct Message" : chat.type === "subject" ? `Subject ${chat.subjectId ?? ""}` : `Class ${chat.classId}`,
      unreadCount: 0,
      lastMessageAt: chat.lastMessageAt ?? null,
    }))
    .sort((a, b) => {
      const left = a.lastMessageAt ? +new Date(a.lastMessageAt) : +new Date(a.chat.createdAt);
      const right = b.lastMessageAt ? +new Date(b.lastMessageAt) : +new Date(b.chat.createdAt);
      return right - left;
    });

  return c.json({ threads });
});

lmsRoutes.get("/lms/chats/:chatId/messages", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const chatId = c.req.param("chatId");

  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!chat) {
    return c.json({ error: "Chat not found." }, 404);
  }

  const participants = chat.participantExternalIds ?? [];
  const allowed = user.role === "super_admin" || chat.classId === user.classId || participants.includes(user.id);
  if (!allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  return c.json({
    messages: rows.map((row) => ({
      _id: row.id,
      chatId: row.chatId,
      senderId: row.senderExternalId,
      content: row.content,
      attachment: parseAttachment(row.attachment),
      createdAt: row.createdAt,
      editedAt: row.editedAt ?? undefined,
      deleted: row.deleted,
    })),
  });
});

lmsRoutes.post("/lms/chats/:chatId/read", async (c) => {
  return c.body(null, 204);
});

lmsRoutes.post("/lms/messages/send", async (c) => {
  const parsed = sendMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role === "super_admin") {
    return c.json({ error: "Super admin has read-only access to chats." }, 403);
  }

  const payload = parsed.data;
  const db = getDb(c.env);

  let chatId = payload.chatId;
  if (!chatId) {
    if (payload.type === "direct") {
      if (!payload.recipientUserId) {
        return c.json({ error: "Direct message requires a recipient." }, 400);
      }
      const ordered = [user.id, payload.recipientUserId].sort();
      chatId = `chat-direct-${payload.classId}-${ordered[0]}-${ordered[1]}`;
    } else if (payload.type === "subject") {
      if (!payload.subjectId) {
        return c.json({ error: "Subject chat requires subjectId." }, 400);
      }
      chatId = `chat-subject-${payload.classId}-${payload.subjectId}`;
    } else {
      chatId = `chat-class-${payload.classId}`;
    }
  }

  const [existingChat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!existingChat) {
    await db.insert(chats).values({
      id: chatId,
      type: payload.type,
      classId: payload.classId,
      subjectId: payload.subjectId,
      participantExternalIds: payload.type === "direct" && payload.recipientUserId ? [user.id, payload.recipientUserId].sort() : undefined,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
    });
  }

  const messageId = `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const content = payload.content.trim() || (payload.attachment ? "Attachment" : "");
  if (!content && !payload.attachment) {
    return c.json({ error: "Message content or attachment is required." }, 400);
  }

  const [created] = await db
    .insert(messages)
    .values({
      id: messageId,
      chatId,
      senderExternalId: user.id,
      content,
      attachment: payload.attachment ? JSON.stringify(payload.attachment) : null,
      createdAt,
      deleted: false,
    })
    .returning();

  await db.update(chats).set({ lastMessageAt: createdAt }).where(eq(chats.id, chatId));

  if (payload.type === "direct" && payload.recipientUserId) {
    try {
      const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;
      await enqueueNotification(c.env, {
        recipientExternalId: payload.recipientUserId,
        title: "New Message",
        body: `${user.name}: ${preview}`,
        category: "message",
        resourceId: chatId,
        resourceType: "chat",
        actorName: user.name,
      });
    } catch (err) {
      console.error("[lms] Failed to queue message notification", err);
    }
  }

  return c.json({
    message: {
      _id: created.id,
      chatId: created.chatId,
      senderId: created.senderExternalId,
      content: created.content,
      attachment: parseAttachment(created.attachment),
      createdAt: created.createdAt,
      editedAt: created.editedAt ?? undefined,
      deleted: created.deleted,
    },
  });
});

lmsRoutes.patch("/lms/messages/:messageId", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role === "super_admin") {
    return c.json({ error: "Super admin has read-only access to chats." }, 403);
  }
  const payload = z.object({ content: z.string().min(1) }).safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const db = getDb(c.env);
  const messageId = c.req.param("messageId");
  const [existing] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!existing) {
    return c.json({ error: "Message not found." }, 404);
  }
  if (existing.senderExternalId !== user.id) {
    return c.json({ error: "Cannot edit other users' messages." }, 403);
  }

  const [updated] = await db
    .update(messages)
    .set({ content: payload.data.content.trim(), editedAt: new Date().toISOString() })
    .where(eq(messages.id, messageId))
    .returning();

  return c.json({
    message: {
      _id: updated.id,
      chatId: updated.chatId,
      senderId: updated.senderExternalId,
      content: updated.content,
      attachment: parseAttachment(updated.attachment),
      createdAt: updated.createdAt,
      editedAt: updated.editedAt ?? undefined,
      deleted: updated.deleted,
    },
  });
});

lmsRoutes.delete("/lms/messages/:messageId", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role === "super_admin") {
    return c.json({ error: "Super admin has read-only access to chats." }, 403);
  }
  const db = getDb(c.env);
  const messageId = c.req.param("messageId");
  const [existing] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!existing) {
    return c.json({ error: "Message not found." }, 404);
  }
  if (existing.senderExternalId !== user.id) {
    return c.json({ error: "Cannot delete other users' messages." }, 403);
  }

  await db
    .update(messages)
    .set({ content: "Message deleted", attachment: null, deleted: true })
    .where(eq(messages.id, messageId));

  return c.body(null, 204);
});

lmsRoutes.get("/lms/chats/direct-contacts", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role === "super_admin") {
    return c.json({ contacts: [] });
  }
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.classId, user.classId), eq(users.approved, true)));

  const contacts = rows
    .map(toPublicUser)
    .filter((candidate) => candidate.id !== user.id)
    .map(({ dbId, ...rest }) => rest);

  return c.json({ contacts });
});



