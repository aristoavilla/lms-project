import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type Role =
  | "super_admin"
  | "main_teacher"
  | "specialized_teacher"
  | "administrative_student"
  | "regular_student";

const DEFAULT_PASSWORD = "Password123!";

function isStudent(role: Role) {
  return role === "regular_student" || role === "administrative_student";
}

function canManageAnnouncements(role: Role) {
  return role === "main_teacher" || role === "specialized_teacher" || role === "administrative_student";
}

function canViewRanking(role: Role) {
  return role === "main_teacher" || role === "specialized_teacher" || role === "super_admin";
}

function canViewOverallRanking(role: Role) {
  return role === "main_teacher" || role === "super_admin";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getUserByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getClassByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("class")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getSubjectByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("subjects")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getSemesterByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("semesters")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getAssignmentByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("assignments")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getAnnouncementByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("announcements")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

async function getSubmissionByExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("submissions")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
}

function toUserDto(user: {
  externalId?: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  externalClassId?: string;
  externalSubjectId?: string;
  externalTaughtClassIds?: string[];
  bio?: string;
  profileImageId?: string;
  profileImageUrl?: string;
}) {
  return {
    _id: user.externalId ?? "",
    name: user.name,
    email: user.email,
    role: user.role,
    approved: user.approved,
    classId: user.externalClassId ?? "",
    subjectId: user.externalSubjectId,
    taughtClassIds: user.externalTaughtClassIds,
    bio: user.bio,
    profileImageId: user.profileImageId,
    profileImageUrl: user.profileImageUrl,
  };
}

function toAssignmentDto(assignment: {
  externalId?: string;
  externalSubjectId?: string;
  externalClassId?: string;
  externalSemesterId?: string;
  title: string;
  description: string;
  deadline: string;
  allowLate: boolean;
  allowResubmit: boolean;
  totalScore: number;
  externalCreatedBy?: string;
  assignmentType?: "file" | "text" | "quiz";
}) {
  return {
    _id: assignment.externalId ?? "",
    subjectId: assignment.externalSubjectId ?? "",
    classId: assignment.externalClassId ?? "",
    semesterId: assignment.externalSemesterId ?? "",
    title: assignment.title,
    description: assignment.description,
    deadline: assignment.deadline,
    allowLate: assignment.allowLate,
    allowResubmit: assignment.allowResubmit,
    totalScore: assignment.totalScore,
    createdBy: assignment.externalCreatedBy ?? "",
    assignmentType: assignment.assignmentType ?? "text",
  };
}

function toSubmissionDto(submission: {
  externalId?: string;
  externalAssignmentId?: string;
  externalStudentId?: string;
  submissionType?: "file" | "text" | "quiz";
  payload?: string;
  score?: number;
  comment?: string;
  submittedAt: string;
  late: boolean;
}) {
  return {
    _id: submission.externalId ?? "",
    assignmentId: submission.externalAssignmentId ?? "",
    studentId: submission.externalStudentId ?? "",
    submissionType: submission.submissionType ?? "text",
    payload: submission.payload ?? "",
    score: submission.score,
    comment: submission.comment,
    submittedAt: submission.submittedAt,
    late: submission.late,
  };
}

export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", "u-super-1"))
      .first();
    if (existing) {
      return { seeded: false };
    }

    const class1A = await ctx.db.insert("class", {
      externalId: "class-1A",
      name: "Class 1A",
    });

    const sem1 = await ctx.db.insert("semesters", {
      externalId: "sem-1-2026",
      name: "Semester 1 2026",
      startDate: "2026-01-05",
      endDate: "2026-06-30",
    });

    const superAdminId = await ctx.db.insert("users", {
      externalId: "u-super-1",
      name: "Super Admin",
      email: "admin@school.edu",
      password: DEFAULT_PASSWORD,
      role: "super_admin",
      approved: true,
      classId: class1A,
      externalClassId: "class-1A",
      bio: "",
    });

    await ctx.db.patch(class1A, { mainTeacherId: superAdminId });

    const mainTeacherId = await ctx.db.insert("users", {
      externalId: "u-main-1",
      name: "Mrs. Johnson",
      email: "johnson@school.edu",
      password: DEFAULT_PASSWORD,
      role: "main_teacher",
      approved: true,
      classId: class1A,
      externalClassId: "class-1A",
      externalSubjectId: "subject-math",
      externalTaughtClassIds: ["class-1A"],
      bio: "",
    });

    const specializedTeacherId = await ctx.db.insert("users", {
      externalId: "u-spec-10",
      name: "Ms. Clarke",
      email: "clarke@school.edu",
      password: DEFAULT_PASSWORD,
      role: "specialized_teacher",
      approved: true,
      classId: class1A,
      externalClassId: "class-1A",
      externalSubjectId: "subject-physics",
      externalTaughtClassIds: ["class-1A"],
      bio: "",
    });

    const studentId = await ctx.db.insert("users", {
      externalId: "u-student-1a-1",
      name: "Student 1A-1",
      email: "student.1a.1@school.edu",
      password: DEFAULT_PASSWORD,
      role: "regular_student",
      approved: true,
      classId: class1A,
      externalClassId: "class-1A",
      bio: "",
    });

    await ctx.db.insert("users", {
      externalId: "u-admin-student-1a-1",
      name: "Admin Student 1A-1",
      email: "admin.student.1a.1@school.edu",
      password: DEFAULT_PASSWORD,
      role: "administrative_student",
      approved: true,
      classId: class1A,
      externalClassId: "class-1A",
      bio: "",
    });

    const subjectDefs = [
      { id: "subject-math", name: "Math", teacherId: mainTeacherId },
      { id: "subject-english", name: "English", teacherId: mainTeacherId },
      { id: "subject-chemistry", name: "Chemistry", teacherId: mainTeacherId },
      { id: "subject-physics", name: "Physics", teacherId: specializedTeacherId },
      { id: "subject-biology", name: "Biology", teacherId: specializedTeacherId },
      { id: "subject-history", name: "History", teacherId: specializedTeacherId },
    ] as const;

    const subjectIdMap = new Map<string, string>();
    for (const subjectDef of subjectDefs) {
      const createdId = await ctx.db.insert("subjects", {
        externalId: subjectDef.id,
        name: subjectDef.name,
        classId: class1A,
        externalClassId: "class-1A",
        teacherId: subjectDef.teacherId,
      });
      subjectIdMap.set(subjectDef.id, createdId);
    }

    const assignmentId = await ctx.db.insert("assignments", {
      externalId: "as-math-1",
      externalSubjectId: "subject-math",
      externalClassId: "class-1A",
      externalSemesterId: "sem-1-2026",
      externalCreatedBy: "u-main-1",
      assignmentType: "file",
      subjectId: subjectIdMap.get("subject-math") as never,
      semesterId: sem1,
      title: "Linear Equations Worksheet",
      description: "Complete worksheet and submit before deadline.",
      deadline: "2026-03-12T23:59:00.000Z",
      allowLate: true,
      allowResubmit: true,
      totalScore: 100,
      createdBy: mainTeacherId,
    });

    await ctx.db.insert("submissions", {
      externalId: "subm-as-math-1-u-student-1a-1",
      externalAssignmentId: "as-math-1",
      externalStudentId: "u-student-1a-1",
      submissionType: "file",
      payload: "as-math-1-u-student-1a-1.pdf",
      assignmentId,
      studentId,
      submittedAt: new Date().toISOString(),
      late: false,
      score: 82,
      comment: "Good work.",
    });

    await ctx.db.insert("announcements", {
      externalId: "ann-class-1A-1",
      externalCreatedBy: "u-main-1",
      externalClassId: "class-1A",
      title: "Weekly update for 1A",
      content: "Please review assignment deadlines and attendance updates.",
      createdBy: mainTeacherId,
      createdAt: new Date().toISOString(),
      classId: class1A,
    });

    await ctx.db.insert("attendance", {
      externalId: "att-class-1A-u-student-1a-1-1",
      externalSubjectId: "subject-math",
      externalClassId: "class-1A",
      externalSemesterId: "sem-1-2026",
      externalStudentId: "u-student-1a-1",
      subjectId: subjectIdMap.get("subject-math") as never,
      semesterId: sem1,
      studentId,
      date: new Date().toISOString().slice(0, 10),
      status: "Present",
    });

    return { seeded: true };
  },
});

export const loginWithEmail = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error("User not found.");
    }
    const expected = user.password ?? DEFAULT_PASSWORD;
    if (expected !== args.password) {
      throw new Error("Invalid email or password.");
    }
    return toUserDto(user);
  },
});

export const loginWithOAuth = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error("User not found.");
    }
    return toUserDto(user);
  },
});

export const registerAccount = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    classId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      throw new Error("Email already registered.");
    }

    const classExternalId = args.classId ?? "class-1A";
    const classDoc = await getClassByExternalId(ctx, classExternalId);
    if (!classDoc) {
      throw new Error("Class is invalid.");
    }

    const externalId = `u-regular-student-${Date.now()}`;
    const userId = await ctx.db.insert("users", {
      externalId,
      name: args.name.trim(),
      email,
      password: args.password?.trim() || DEFAULT_PASSWORD,
      role: "regular_student",
      approved: false,
      classId: classDoc._id,
      externalClassId: classExternalId,
      bio: "",
    });
    const created = await ctx.db.get(userId);
    if (!created) {
      throw new Error("Failed to create user.");
    }
    return toUserDto(created);
  },
});

export const currentUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByExternalId(ctx, args.userId);
    if (!user) {
      throw new Error("User not found.");
    }
    return toUserDto(user);
  },
});

export const listUsers = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    const allUsers = await ctx.db.query("users").collect();
    if (requester.role === "super_admin") {
      return allUsers.map(toUserDto);
    }
    return allUsers
      .filter((row) => row.externalClassId === requester.externalClassId)
      .map(toUserDto);
  },
});

export const listSubjectsByClass = query({
  args: { classId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("subjects").collect();
    const unique = new Map<string, { _id: string; name: string }>();
    for (const row of all) {
      if (!row.externalId) {
        continue;
      }
      if (args.classId && row.externalClassId !== args.classId) {
        continue;
      }
      if (!unique.has(row.externalId)) {
        unique.set(row.externalId, { _id: row.externalId, name: row.name as never });
      }
    }
    return Array.from(unique.values());
  },
});

export const listAssignmentsForUser = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }

    const allAssignments = await ctx.db.query("assignments").collect();
    if (requester.role === "super_admin") {
      return allAssignments.map(toAssignmentDto);
    }
    if (isStudent(requester.role)) {
      return allAssignments
        .filter((row) => row.externalClassId === requester.externalClassId)
        .map(toAssignmentDto);
    }

    const classIds = new Set([requester.externalClassId, ...(requester.externalTaughtClassIds ?? [])]);
    return allAssignments
      .filter((row) => {
        if (!row.externalClassId || !classIds.has(row.externalClassId)) {
          return false;
        }
        if (!requester.externalSubjectId) {
          return true;
        }
        return row.externalSubjectId === requester.externalSubjectId;
      })
      .map(toAssignmentDto);
  },
});

export const createAssignment = mutation({
  args: {
    requesterId: v.string(),
    title: v.string(),
    description: v.string(),
    subjectId: v.string(),
    classId: v.string(),
    deadline: v.string(),
    totalScore: v.number(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    if (requester.role !== "main_teacher" && requester.role !== "specialized_teacher") {
      throw new Error("Only teachers can create assignments.");
    }

    const classDoc = await getClassByExternalId(ctx, args.classId);
    const subjectDoc = await getSubjectByExternalId(ctx, args.subjectId);
    const semester = (await getSemesterByExternalId(ctx, "sem-1-2026")) ?? (await ctx.db.query("semesters").first());
    if (!classDoc || !subjectDoc || !semester) {
      throw new Error("Invalid class/subject/semester.");
    }

    const externalId = `as-${Date.now()}`;
    await ctx.db.insert("assignments", {
      externalId,
      externalSubjectId: args.subjectId,
      externalClassId: args.classId,
      externalSemesterId: "sem-1-2026",
      externalCreatedBy: requester.externalId,
      assignmentType: "text",
      subjectId: subjectDoc._id,
      semesterId: semester._id,
      title: args.title,
      description: args.description,
      deadline: args.deadline,
      allowLate: true,
      allowResubmit: true,
      totalScore: args.totalScore,
      createdBy: requester._id,
    });
  },
});

export const listAnnouncementsForUser = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    const rows = await ctx.db.query("announcements").collect();
    const filtered =
      requester.role === "super_admin"
        ? rows
        : rows.filter((row) => row.externalClassId === requester.externalClassId);

    return filtered
      .map((row) => ({
        _id: row.externalId ?? "",
        title: row.title,
        content: row.content,
        createdBy: row.externalCreatedBy ?? "",
        attachment: row.externalAttachment,
        scheduledAt: row.scheduledAt,
        createdAt: row.createdAt,
        classId: row.externalClassId ?? "",
      }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
});

export const createAnnouncement = mutation({
  args: {
    requesterId: v.string(),
    title: v.string(),
    content: v.string(),
    attachment: v.optional(v.string()),
    scheduledAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester || !requester.externalClassId || !requester.externalId) {
      throw new Error("Requester not found.");
    }
    if (!canManageAnnouncements(requester.role)) {
      throw new Error("You do not have permission to create announcements.");
    }
    const classDoc = await getClassByExternalId(ctx, requester.externalClassId);
    if (!classDoc) {
      throw new Error("Class not found.");
    }

    const externalId = `ann-${Date.now()}`;
    await ctx.db.insert("announcements", {
      externalId,
      externalCreatedBy: requester.externalId,
      externalClassId: requester.externalClassId,
      externalAttachment: args.attachment,
      title: args.title,
      content: args.content,
      createdBy: requester._id,
      createdAt: new Date().toISOString(),
      classId: classDoc._id,
      scheduledAt: args.scheduledAt,
    });

    return {
      _id: externalId,
      title: args.title,
      content: args.content,
      attachment: args.attachment,
      scheduledAt: args.scheduledAt,
      createdBy: requester.externalId,
      createdAt: new Date().toISOString(),
      classId: requester.externalClassId,
    };
  },
});

export const updateAnnouncement = mutation({
  args: {
    requesterId: v.string(),
    announcementId: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const announcement = await getAnnouncementByExternalId(ctx, args.announcementId);
    if (!requester || !announcement) {
      throw new Error("Announcement not found.");
    }
    if (announcement.externalCreatedBy !== requester.externalId) {
      throw new Error("You can edit only your own announcements.");
    }
    await ctx.db.patch(announcement._id, {
      title: args.title,
      content: args.content,
    });
  },
});

export const deleteAnnouncement = mutation({
  args: {
    requesterId: v.string(),
    announcementId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const announcement = await getAnnouncementByExternalId(ctx, args.announcementId);
    if (!requester || !announcement) {
      throw new Error("Announcement not found.");
    }
    if (announcement.externalCreatedBy !== requester.externalId) {
      throw new Error("You can delete only your own announcements.");
    }
    await ctx.db.delete(announcement._id);
  },
});

export const submitAssignment = mutation({
  args: {
    requesterId: v.string(),
    assignmentId: v.string(),
    payload: v.string(),
    submissionType: v.union(v.literal("file"), v.literal("text"), v.literal("quiz")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester || !requester.externalId || !isStudent(requester.role)) {
      throw new Error("Only students can submit assignments.");
    }

    const assignment = await getAssignmentByExternalId(ctx, args.assignmentId);
    if (!assignment || assignment.externalClassId !== requester.externalClassId) {
      throw new Error("Assignment is not available for this student class.");
    }

    const now = new Date();
    const isLate = now.getTime() > new Date(assignment.deadline).getTime();
    if (isLate && !assignment.allowLate) {
      throw new Error("Late submission is not allowed for this assignment.");
    }

    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_external_assignment", (q) => q.eq("externalAssignmentId", args.assignmentId))
      .collect();
    const mine = existing.find((row) => row.externalStudentId === requester.externalId);
    if (mine && !assignment.allowResubmit) {
      throw new Error("Resubmission is not allowed for this assignment.");
    }

    const payload = {
      submissionType: args.submissionType,
      payload: args.payload,
      submittedAt: now.toISOString(),
      late: isLate,
    };

    if (mine) {
      await ctx.db.patch(mine._id, payload);
      return;
    }

    await ctx.db.insert("submissions", {
      externalId: `subm-${Date.now()}-${requester.externalId}`,
      externalAssignmentId: args.assignmentId,
      externalStudentId: requester.externalId,
      assignmentId: assignment._id,
      studentId: requester._id,
      ...payload,
    });
  },
});

export const gradeSubmission = mutation({
  args: {
    requesterId: v.string(),
    submissionId: v.string(),
    score: v.number(),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const submission = await getSubmissionByExternalId(ctx, args.submissionId);
    if (!requester || !submission) {
      throw new Error("Submission not found.");
    }
    if (requester.role !== "main_teacher" && requester.role !== "specialized_teacher") {
      throw new Error("Only teachers can grade submissions.");
    }
    await ctx.db.patch(submission._id, {
      score: Math.max(0, Math.min(100, args.score)),
      comment: args.comment,
    });
  },
});

export const listSubmissionsForAssignment = query({
  args: {
    requesterId: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_external_assignment", (q) => q.eq("externalAssignmentId", args.assignmentId))
      .collect();
    return submissions.map(toSubmissionDto);
  },
});

export const getSubmissionDetail = query({
  args: {
    requesterId: v.string(),
    submissionId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const submission = await getSubmissionByExternalId(ctx, args.submissionId);
    if (!requester || !submission) {
      throw new Error("Submission not found.");
    }
    const assignment = await getAssignmentByExternalId(ctx, submission.externalAssignmentId ?? "");
    const student = await getUserByExternalId(ctx, submission.externalStudentId ?? "");
    if (!assignment || !student) {
      throw new Error("Submission detail references missing records.");
    }
    return {
      submission: toSubmissionDto(submission),
      assignment: toAssignmentDto(assignment),
      student: toUserDto(student),
    };
  },
});

export const listAttendance = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }

    const rows = await ctx.db.query("attendance").collect();
    let filtered = rows;
    if (isStudent(requester.role) && requester.externalId) {
      filtered = rows.filter((row) => row.externalStudentId === requester.externalId);
    } else if (requester.role !== "super_admin") {
      filtered = rows.filter((row) => row.externalClassId === requester.externalClassId);
      if (requester.role === "specialized_teacher" && requester.externalSubjectId) {
        filtered = filtered.filter((row) => row.externalSubjectId === requester.externalSubjectId);
      }
    }

    return filtered.map((row) => ({
      _id: row.externalId ?? "",
      subjectId: row.externalSubjectId ?? "",
      classId: row.externalClassId ?? "",
      semesterId: row.externalSemesterId ?? "",
      studentId: row.externalStudentId ?? "",
      date: row.date,
      status: row.status,
    }));
  },
});

export const markAttendance = mutation({
  args: {
    requesterId: v.string(),
    subjectId: v.string(),
    classId: v.string(),
    studentId: v.string(),
    date: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent"), v.literal("Excused")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    if (requester.role !== "main_teacher" && requester.role !== "specialized_teacher") {
      throw new Error("Only teachers can mark attendance.");
    }

    const subject = await getSubjectByExternalId(ctx, args.subjectId);
    const classDoc = await getClassByExternalId(ctx, args.classId);
    const student = await getUserByExternalId(ctx, args.studentId);
    const semester = (await getSemesterByExternalId(ctx, "sem-1-2026")) ?? (await ctx.db.query("semesters").first());
    if (!subject || !classDoc || !student || !semester) {
      throw new Error("Attendance references invalid entities.");
    }

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_external_student", (q) => q.eq("externalStudentId", args.studentId))
      .collect();

    const duplicate = existing.find(
      (row) =>
        row.externalSubjectId === args.subjectId &&
        row.externalClassId === args.classId &&
        row.date === args.date,
    );

    const payload = {
      externalSubjectId: args.subjectId,
      externalClassId: args.classId,
      externalSemesterId: "sem-1-2026",
      externalStudentId: args.studentId,
      subjectId: subject._id,
      semesterId: semester._id,
      studentId: student._id,
      date: args.date,
      status: args.status,
    };

    if (duplicate) {
      await ctx.db.patch(duplicate._id, payload);
      return;
    }

    await ctx.db.insert("attendance", {
      externalId: `att-${Date.now()}-${args.studentId}`,
      ...payload,
    });
  },
});

function calculateSubjectRanking(
  assignments: Array<{ externalId?: string; totalScore: number }>,
  submissions: Array<{ externalAssignmentId?: string; externalStudentId?: string; score?: number; submittedAt: string }>,
  students: Array<{ externalId?: string; name: string }>,
) {
  const rows: Array<{ studentId: string; studentName: string; average: number; earliestSubmissionAt: string }> = [];
  for (const student of students) {
    if (!student.externalId) {
      continue;
    }
    const assignmentIds = new Set(assignments.map((a) => a.externalId).filter(Boolean));
    const studentSubs = submissions.filter(
      (entry) =>
        entry.externalStudentId === student.externalId &&
        entry.externalAssignmentId &&
        assignmentIds.has(entry.externalAssignmentId) &&
        typeof entry.score === "number",
    );
    if (studentSubs.length === 0) {
      continue;
    }
    const total = studentSubs.reduce((sum, row) => sum + (row.score ?? 0), 0);
    const earliestSubmissionAt = studentSubs
      .map((row) => row.submittedAt)
      .sort()[0];

    rows.push({
      studentId: student.externalId,
      studentName: student.name,
      average: total / studentSubs.length,
      earliestSubmissionAt,
    });
  }

  return rows.sort((a, b) => {
    if (b.average !== a.average) {
      return b.average - a.average;
    }
    const t = +new Date(a.earliestSubmissionAt) - +new Date(b.earliestSubmissionAt);
    if (t !== 0) {
      return t;
    }
    return a.studentName.localeCompare(b.studentName);
  });
}

export const getSubjectRanking = query({
  args: {
    requesterId: v.string(),
    subjectId: v.string(),
    classId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    if (!canViewRanking(requester.role)) {
      throw new Error("Ranking is blocked for students.");
    }

    const assignments = (await ctx.db.query("assignments").collect()).filter(
      (row) => row.externalClassId === args.classId && row.externalSubjectId === args.subjectId,
    );
    const submissions = await ctx.db.query("submissions").collect();
    const students = (await ctx.db.query("users").collect()).filter(
      (row) => row.externalClassId === args.classId && (row.role === "regular_student" || row.role === "administrative_student"),
    );

    return calculateSubjectRanking(assignments, submissions, students);
  },
});

export const getOverallRanking = query({
  args: {
    requesterId: v.string(),
    classId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    if (!canViewOverallRanking(requester.role)) {
      throw new Error("Only main teacher and super admin can access overall ranking.");
    }

    const effectiveClassId = requester.role === "main_teacher" ? requester.externalClassId : (args.classId ?? requester.externalClassId);
    const assignments = (await ctx.db.query("assignments").collect()).filter(
      (row) => row.externalClassId === effectiveClassId,
    );
    const submissions = await ctx.db.query("submissions").collect();
    const students = (await ctx.db.query("users").collect()).filter(
      (row) => row.externalClassId === effectiveClassId && (row.role === "regular_student" || row.role === "administrative_student"),
    );

    return calculateSubjectRanking(assignments, submissions, students);
  },
});

export const approveUser = mutation({
  args: { requesterId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const target = await getUserByExternalId(ctx, args.userId);
    if (!requester || !target || requester.role !== "super_admin") {
      throw new Error("Only super admin can approve users.");
    }
    await ctx.db.patch(target._id, { approved: true });
  },
});

export const assignRole = mutation({
  args: {
    requesterId: v.string(),
    userId: v.string(),
    role: v.union(
      v.literal("main_teacher"),
      v.literal("specialized_teacher"),
      v.literal("administrative_student"),
      v.literal("regular_student"),
    ),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const target = await getUserByExternalId(ctx, args.userId);
    if (!requester || !target || requester.role !== "super_admin") {
      throw new Error("Only super admin can assign roles.");
    }
    await ctx.db.patch(target._id, { role: args.role });
  },
});

export const assignSubjectTeacher = mutation({
  args: {
    requesterId: v.string(),
    subjectId: v.string(),
    teacherId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    const teacher = await getUserByExternalId(ctx, args.teacherId);
    const subject = await getSubjectByExternalId(ctx, args.subjectId);
    if (!requester || !teacher || !subject || requester.role !== "super_admin") {
      throw new Error("Only super admin can assign subject owners.");
    }
    await ctx.db.patch(teacher._id, { externalSubjectId: args.subjectId });
    await ctx.db.patch(subject._id, { teacherId: teacher._id });
  },
});

export const listVisibleProfiles = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    const allUsers = await ctx.db.query("users").collect();
    const visible =
      requester.role === "super_admin"
        ? allUsers
        : allUsers.filter((row) => row.externalClassId === requester.externalClassId && row.approved);
    return visible.map(toUserDto);
  },
});

export const updateOwnProfile = mutation({
  args: {
    requesterId: v.string(),
    name: v.string(),
    bio: v.string(),
    profileImageUrl: v.optional(v.string()),
    profileImageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserByExternalId(ctx, args.requesterId);
    if (!requester) {
      throw new Error("Requester not found.");
    }
    await ctx.db.patch(requester._id, {
      name: args.name.trim(),
      bio: args.bio.trim(),
      profileImageUrl: args.profileImageUrl,
      profileImageId: args.profileImageId as never,
    });
    const updated = await ctx.db.get(requester._id);
    if (!updated) {
      throw new Error("Unable to load updated profile.");
    }
    return toUserDto(updated);
  },
});
