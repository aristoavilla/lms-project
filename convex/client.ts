import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type Role =
  | "super_admin"
  | "main_teacher"
  | "specialized_teacher"
  | "administrative_student"
  | "regular_student";

const DEFAULT_PASSWORD = "Password123!";

const CLASS_CODES = ["1A", "1B", "1C", "2A", "2B", "2C", "3A", "3B", "3C"] as const;
const SUBJECT_CATALOG = [
  { key: "matematika", label: "Matematika" },
  { key: "bahasa-indonesia", label: "Bahasa Indonesia" },
  { key: "ipa", label: "IPA" },
  { key: "bahasa-inggris", label: "Bahasa Inggris" },
  { key: "sejarah", label: "Sejarah" },
  { key: "informatika", label: "Informatika" },
] as const;

const INDONESIAN_FIRST_NAMES = [
  "Ahmad", "Budi", "Rizky", "Dimas", "Fajar", "Andi", "Arif", "Bayu", "Rendra", "Wahyu",
  "Ari", "Yoga", "Hendra", "Deni", "Rafi", "Ilham", "Reza", "Fikri", "Adit", "Eko",
  "Rina", "Siti", "Dewi", "Ayu", "Nadia", "Putri", "Lestari", "Fitri", "Indah", "Maya",
  "Wulan", "Nisa", "Amelia", "Rahma", "Kartika", "Citra", "Puspita", "Desi", "Nabila", "Tika",
  "Salsa", "Novi", "Annisa", "Intan", "Niken", "Rara", "Yuni", "Tiara", "Vina", "Mila",
] as const;

const INDONESIAN_LAST_NAMES = [
  "Saputra", "Pratama", "Wijaya", "Nugroho", "Santoso", "Setiawan", "Hidayat", "Permana", "Kusuma", "Firmansyah",
  "Ramadhan", "Syahputra", "Maulana", "Utami", "Lestari", "Anggraini", "Sari", "Wati", "Handayani", "Puspitasari",
  "Safitri", "Aulia", "Kurniawan", "Purnama", "Gunawan", "Pangestu", "Hermawan", "Saputri", "Rahmawati", "Iskandar",
] as const;

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".");
}

function createUniqueNameGenerator() {
  let index = 0;
  const seen = new Set<string>();
  return () => {
    while (index < INDONESIAN_FIRST_NAMES.length * INDONESIAN_LAST_NAMES.length) {
      const first = INDONESIAN_FIRST_NAMES[Math.floor(index / INDONESIAN_LAST_NAMES.length)];
      const last = INDONESIAN_LAST_NAMES[index % INDONESIAN_LAST_NAMES.length];
      index += 1;
      const fullName = `${first} ${last}`;
      if (!seen.has(fullName)) {
        seen.add(fullName);
        return fullName;
      }
    }
    throw new Error("Name pool exhausted. Add more Indonesian names.");
  };
}

async function clearTable(ctx: any, tableName: string) {
  const rows = await ctx.db.query(tableName).collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

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

async function getUserByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("users")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getClassByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("class")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getSubjectByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("subjects")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getSemesterByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("semesters")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getAssignmentByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("assignments")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getAnnouncementByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("announcements")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
    .first();
}

async function getSubmissionByExternalId(ctx: any, externalId: string): Promise<any> {
  return await ctx.db
    .query("submissions")
    .withIndex("by_external_id", (q: any) => q.eq("externalId", externalId))
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
    const allUsers = await ctx.db.query("users").collect();
    const allClasses = await ctx.db.query("class").collect();
    const allSubjectTeachers = await ctx.db.query("subjectTeachers").collect();

    const studentCount = allUsers.filter(
      (row: any) => row.role === "regular_student" || row.role === "administrative_student",
    ).length;

    if (allClasses.length === 9 && studentCount === 270 && allSubjectTeachers.length >= 108) {
      return { seeded: false };
    }

    // Reset all app tables when data is partial or outdated.
    await clearTable(ctx, "messages");
    await clearTable(ctx, "chats");
    await clearTable(ctx, "attendance");
    await clearTable(ctx, "submissions");
    await clearTable(ctx, "assignments");
    await clearTable(ctx, "announcements");
    await clearTable(ctx, "subjectTeachers");
    await clearTable(ctx, "subjects");
    await clearTable(ctx, "users");
    await clearTable(ctx, "semesters");
    await clearTable(ctx, "class");

    const classByExternalId = new Map<string, any>();
    const mainTeacherByClassExternal = new Map<string, string>();
    const userDocIdByExternalId = new Map<string, any>();
    const studentsByClassExternal = new Map<string, Array<{ userId: any; externalId: string; name: string }>>();
    const teacherSubjectExternalIds = new Map<string, string[]>();
    const teacherSubjectDocIds = new Map<string, any[]>();
    const teacherClassExternalIds = new Map<string, Set<string>>();
    const allTeacherExternalIds: string[] = [];
    const seededSubjects: Array<{
      subjectId: any;
      externalId: string;
      classExternalId: string;
      name: string;
      primaryTeacherExternalId: string;
      coTeacherExternalId: string;
    }> = [];

    const nextName = createUniqueNameGenerator();
    const emailCounter = new Map<string, number>();

    const createEmail = (name: string, bucket: string) => {
      const base = `${slugifyName(name)}.${bucket.toLowerCase()}`;
      const count = (emailCounter.get(base) ?? 0) + 1;
      emailCounter.set(base, count);
      return `${base}${count}@school.edu`;
    };

    const markTeacherSubject = (
      teacherExternalId: string,
      subjectExternalId: string,
      subjectId: any,
      classExternalId: string,
    ) => {
      const subjectExternalIds = teacherSubjectExternalIds.get(teacherExternalId) ?? [];
      if (!subjectExternalIds.includes(subjectExternalId)) {
        subjectExternalIds.push(subjectExternalId);
      }
      teacherSubjectExternalIds.set(teacherExternalId, subjectExternalIds);

      const subjectDocIds = teacherSubjectDocIds.get(teacherExternalId) ?? [];
      if (!subjectDocIds.includes(subjectId)) {
        subjectDocIds.push(subjectId);
      }
      teacherSubjectDocIds.set(teacherExternalId, subjectDocIds);

      const taughtClasses = teacherClassExternalIds.get(teacherExternalId) ?? new Set<string>();
      taughtClasses.add(classExternalId);
      teacherClassExternalIds.set(teacherExternalId, taughtClasses);
    };

    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const classId = await ctx.db.insert("class", {
        externalId: externalClassId,
        name: `Class ${classCode}`,
      });
      classByExternalId.set(externalClassId, classId);
      studentsByClassExternal.set(externalClassId, []);
    }

    const sem1 = await ctx.db.insert("semesters", {
      externalId: "sem-1-2026",
      name: "Semester 1 2026",
      startDate: "2026-01-05",
      endDate: "2026-06-30",
    });

    await ctx.db.insert("semesters", {
      externalId: "sem-2-2026",
      name: "Semester 2 2026",
      startDate: "2026-07-15",
      endDate: "2026-12-15",
    });

    const superAdminClassExternal = "class-1A";
    const superAdminId = await ctx.db.insert("users", {
      externalId: "u-super-1",
      name: "Budi Santoso",
      email: "admin@school.edu",
      password: DEFAULT_PASSWORD,
      role: "super_admin",
      approved: true,
      classId: classByExternalId.get(superAdminClassExternal),
      externalClassId: superAdminClassExternal,
      bio: "Super administrator sistem LMS.",
    });
    userDocIdByExternalId.set("u-super-1", superAdminId);

    const specializedTeacherExternalIds: string[] = [];

    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const mainTeacherExternalId = `u-main-${classCode.toLowerCase()}`;
      const mainTeacherName = nextName();
      const mainTeacherId = await ctx.db.insert("users", {
        externalId: mainTeacherExternalId,
        name: mainTeacherName,
        email: createEmail(mainTeacherName, `main.${classCode}`),
        password: DEFAULT_PASSWORD,
        role: "main_teacher",
        approved: true,
        classId: classByExternalId.get(externalClassId),
        externalClassId,
        externalTaughtClassIds: [externalClassId],
        bio: "Wali kelas dan pengajar utama.",
      });
      userDocIdByExternalId.set(mainTeacherExternalId, mainTeacherId);
      mainTeacherByClassExternal.set(externalClassId, mainTeacherExternalId);
      allTeacherExternalIds.push(mainTeacherExternalId);
      teacherClassExternalIds.set(mainTeacherExternalId, new Set([externalClassId]));
      await ctx.db.patch(classByExternalId.get(externalClassId), { mainTeacherId: mainTeacherId });
    }

    for (let i = 0; i < 12; i += 1) {
      const classCode = CLASS_CODES[i % CLASS_CODES.length];
      const externalClassId = `class-${classCode}`;
      const externalId = `u-spec-${String(i + 1).padStart(2, "0")}`;
      const name = nextName();
      const userId = await ctx.db.insert("users", {
        externalId,
        name,
        email: createEmail(name, `spec.${i + 1}`),
        password: DEFAULT_PASSWORD,
        role: "specialized_teacher",
        approved: true,
        classId: classByExternalId.get(externalClassId),
        externalClassId,
        externalTaughtClassIds: [externalClassId],
        bio: "Guru mata pelajaran lintas kelas.",
      });
      userDocIdByExternalId.set(externalId, userId);
      specializedTeacherExternalIds.push(externalId);
      allTeacherExternalIds.push(externalId);
      teacherClassExternalIds.set(externalId, new Set([externalClassId]));
    }

    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const classStudents = studentsByClassExternal.get(externalClassId) ?? [];

      for (let n = 1; n <= 30; n += 1) {
        const role: Role = n % 10 === 0 ? "administrative_student" : "regular_student";
        const externalId = `${role === "administrative_student" ? "u-admin-student" : "u-student"}-${classCode.toLowerCase()}-${String(n).padStart(2, "0")}`;
        const name = nextName();
        const studentId = await ctx.db.insert("users", {
          externalId,
          name,
          email: createEmail(name, `student.${classCode}`),
          password: DEFAULT_PASSWORD,
          role,
          approved: true,
          classId: classByExternalId.get(externalClassId),
          externalClassId,
          bio: "Siswa aktif pada tahun ajaran 2026.",
        });
        userDocIdByExternalId.set(externalId, studentId);
        classStudents.push({ userId: studentId, externalId, name });
      }
      studentsByClassExternal.set(externalClassId, classStudents);
    }

    for (let classIndex = 0; classIndex < CLASS_CODES.length; classIndex += 1) {
      const classCode = CLASS_CODES[classIndex];
      const externalClassId = `class-${classCode}`;
      const mainTeacherExternalId = mainTeacherByClassExternal.get(externalClassId) as string;

      for (let subjectIndex = 0; subjectIndex < SUBJECT_CATALOG.length; subjectIndex += 1) {
        const subjectMeta = SUBJECT_CATALOG[subjectIndex];
        const subjectExternalId = `subject-${subjectMeta.key}-${classCode.toLowerCase()}`;
        const primaryTeacherExternalId =
          subjectIndex < 3
            ? mainTeacherExternalId
            : specializedTeacherExternalIds[(classIndex + subjectIndex) % specializedTeacherExternalIds.length];
        const primaryTeacherId = userDocIdByExternalId.get(primaryTeacherExternalId);

        const subjectId = await ctx.db.insert("subjects", {
          externalId: subjectExternalId,
          name: subjectMeta.label,
          classId: classByExternalId.get(externalClassId),
          externalClassId,
          teacherId: primaryTeacherId,
        });

        await ctx.db.insert("subjectTeachers", {
          externalId: `st-${subjectExternalId}-${primaryTeacherExternalId}`,
          externalClassId,
          externalSubjectId: subjectExternalId,
          externalTeacherId: primaryTeacherExternalId,
          classId: classByExternalId.get(externalClassId),
          subjectId,
          teacherId: primaryTeacherId,
        });
        markTeacherSubject(primaryTeacherExternalId, subjectExternalId, subjectId, externalClassId);

        const coTeacherExternalId =
          subjectIndex < 3
            ? specializedTeacherExternalIds[(classIndex + subjectIndex + 2) % specializedTeacherExternalIds.length]
            : mainTeacherExternalId;
        if (coTeacherExternalId !== primaryTeacherExternalId) {
          await ctx.db.insert("subjectTeachers", {
            externalId: `st-${subjectExternalId}-${coTeacherExternalId}`,
            externalClassId,
            externalSubjectId: subjectExternalId,
            externalTeacherId: coTeacherExternalId,
            classId: classByExternalId.get(externalClassId),
            subjectId,
            teacherId: userDocIdByExternalId.get(coTeacherExternalId),
          });
          markTeacherSubject(coTeacherExternalId, subjectExternalId, subjectId, externalClassId);
        }

        seededSubjects.push({
          subjectId,
          externalId: subjectExternalId,
          classExternalId: externalClassId,
          name: subjectMeta.label,
          primaryTeacherExternalId,
          coTeacherExternalId,
        });
      }
    }

    for (let i = 0; i < allTeacherExternalIds.length; i += 1) {
      const teacherExternalId = allTeacherExternalIds[i];
      const subjectExternalIds = teacherSubjectExternalIds.get(teacherExternalId) ?? [];
      if (subjectExternalIds.length > 0) {
        continue;
      }
      const fallbackClassExternalId = `class-${CLASS_CODES[i % CLASS_CODES.length]}`;
      const fallbackSubject = seededSubjects.find((row) => row.classExternalId === fallbackClassExternalId);
      if (!fallbackSubject) {
        continue;
      }
      await ctx.db.insert("subjectTeachers", {
        externalId: `st-${fallbackSubject.externalId}-${teacherExternalId}`,
        externalClassId: fallbackClassExternalId,
        externalSubjectId: fallbackSubject.externalId,
        externalTeacherId: teacherExternalId,
        classId: classByExternalId.get(fallbackClassExternalId),
        subjectId: fallbackSubject.subjectId,
        teacherId: userDocIdByExternalId.get(teacherExternalId),
      });
      markTeacherSubject(
        teacherExternalId,
        fallbackSubject.externalId,
        fallbackSubject.subjectId,
        fallbackClassExternalId,
      );
    }

    for (const teacherExternalId of allTeacherExternalIds) {
      const teacherId = userDocIdByExternalId.get(teacherExternalId);
      const subjectExternalIds = teacherSubjectExternalIds.get(teacherExternalId) ?? [];
      const subjectDocIds = teacherSubjectDocIds.get(teacherExternalId) ?? [];
      const taughtClassExternalIds = Array.from(teacherClassExternalIds.get(teacherExternalId) ?? new Set<string>());

      await ctx.db.patch(teacherId, {
        externalSubjectId: subjectExternalIds[0],
        subjectIds: subjectDocIds,
        externalTaughtClassIds: taughtClassExternalIds,
      });
    }

    const now = Date.now();
    for (let i = 0; i < seededSubjects.length; i += 1) {
      const subject = seededSubjects[i];
      const assignmentExternalId = `as-${subject.externalId}-1`;
      const assignmentId = await ctx.db.insert("assignments", {
        externalId: assignmentExternalId,
        externalSubjectId: subject.externalId,
        externalClassId: subject.classExternalId,
        externalSemesterId: "sem-1-2026",
        externalCreatedBy: subject.primaryTeacherExternalId,
        assignmentType: "text",
        subjectId: subject.subjectId,
        semesterId: sem1,
        title: `Tugas ${subject.name} ${subject.classExternalId.replace("class-", "")}`,
        description: `Kerjakan latihan ${subject.name} dan kumpulkan tepat waktu.`,
        deadline: "2026-04-15T23:59:00.000Z",
        allowLate: true,
        allowResubmit: true,
        totalScore: 100,
        createdBy: userDocIdByExternalId.get(subject.primaryTeacherExternalId),
      });

      const classStudents = studentsByClassExternal.get(subject.classExternalId) ?? [];
      for (let s = 0; s < Math.min(10, classStudents.length); s += 1) {
        const student = classStudents[s];
        await ctx.db.insert("submissions", {
          externalId: `subm-${assignmentExternalId}-${student.externalId}`,
          externalAssignmentId: assignmentExternalId,
          externalStudentId: student.externalId,
          submissionType: "text",
          payload: `Jawaban tugas oleh ${student.name}`,
          assignmentId,
          studentId: student.userId,
          submittedAt: new Date(now - (s + i) * 3600_000).toISOString(),
          late: false,
          score: 70 + ((s * 3 + i) % 31),
          comment: "Sudah cukup baik, tingkatkan konsistensi.",
        });
      }
    }

    for (let i = 0; i < seededSubjects.length; i += 1) {
      const subject = seededSubjects[i];
      const classStudents = studentsByClassExternal.get(subject.classExternalId) ?? [];
      const date = `2026-03-${String((i % 20) + 1).padStart(2, "0")}`;
      for (let s = 0; s < Math.min(15, classStudents.length); s += 1) {
        const student = classStudents[s];
        const status = s % 9 === 0 ? "Excused" : s % 5 === 0 ? "Absent" : "Present";
        await ctx.db.insert("attendance", {
          externalId: `att-${subject.externalId}-${student.externalId}-${date}`,
          externalSubjectId: subject.externalId,
          externalClassId: subject.classExternalId,
          externalSemesterId: "sem-1-2026",
          externalStudentId: student.externalId,
          subjectId: subject.subjectId,
          semesterId: sem1,
          studentId: student.userId,
          date,
          status,
        });
      }
    }

    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const mainTeacherExternalId = mainTeacherByClassExternal.get(externalClassId) as string;

      for (let n = 1; n <= 2; n += 1) {
        await ctx.db.insert("announcements", {
          externalId: `ann-${externalClassId}-${n}`,
          externalCreatedBy: mainTeacherExternalId,
          externalClassId,
          title: `Pengumuman ${n} Kelas ${classCode}`,
          content: `Informasi akademik kelas ${classCode} untuk pekan ke-${n}.`,
          createdBy: userDocIdByExternalId.get(mainTeacherExternalId),
          createdAt: new Date(now - n * 86_400_000).toISOString(),
          classId: classByExternalId.get(externalClassId),
        });
      }
    }

    const classChatIdByExternal = new Map<string, any>();
    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const classChatId = await ctx.db.insert("chats", {
        externalId: `chat-class-${classCode.toLowerCase()}`,
        externalClassId,
        type: "class",
        classId: classByExternalId.get(externalClassId),
        createdAt: new Date(now - 10_000).toISOString(),
      });
      classChatIdByExternal.set(externalClassId, classChatId);
    }

    for (const subject of seededSubjects) {
      await ctx.db.insert("chats", {
        externalId: `chat-subject-${subject.externalId}`,
        externalClassId: subject.classExternalId,
        externalSubjectId: subject.externalId,
        type: "subject",
        classId: classByExternalId.get(subject.classExternalId),
        subjectId: subject.subjectId,
        createdAt: new Date(now - 8_000).toISOString(),
      });
    }

    for (const classCode of CLASS_CODES) {
      const externalClassId = `class-${classCode}`;
      const classStudents = studentsByClassExternal.get(externalClassId) ?? [];
      const firstStudent = classStudents[0];
      if (!firstStudent) {
        continue;
      }
      const mainTeacherExternalId = mainTeacherByClassExternal.get(externalClassId) as string;
      await ctx.db.insert("chats", {
        externalId: `chat-direct-${classCode.toLowerCase()}-1`,
        externalClassId,
        externalParticipantIds: [mainTeacherExternalId, firstStudent.externalId],
        type: "direct",
        classId: classByExternalId.get(externalClassId),
        participantIds: [userDocIdByExternalId.get(mainTeacherExternalId), firstStudent.userId],
        createdAt: new Date(now - 7_000).toISOString(),
      });
    }

    const allChats = await ctx.db.query("chats").collect();
    for (let i = 0; i < allChats.length; i += 1) {
      const chat = allChats[i];
      if (chat.type === "class") {
        const classCode = (chat.externalClassId ?? "class-1A").replace("class-", "");
        const mainTeacherExternalId = mainTeacherByClassExternal.get(chat.externalClassId ?? "class-1A") as string;
        await ctx.db.insert("messages", {
          externalId: `msg-${chat.externalId}-1`,
          externalChatId: chat.externalId,
          externalSenderId: mainTeacherExternalId,
          chatId: chat._id,
          senderId: userDocIdByExternalId.get(mainTeacherExternalId),
          content: `Selamat datang di grup kelas ${classCode}.`,
          createdAt: new Date(now - i * 50_000).toISOString(),
          deleted: false,
        });
      } else if (chat.type === "subject") {
        const teacherMapping = await ctx.db
          .query("subjectTeachers")
          .withIndex("by_subject", (q) => q.eq("subjectId", chat.subjectId as any))
          .first();
        if (teacherMapping) {
          await ctx.db.insert("messages", {
            externalId: `msg-${chat.externalId}-1`,
            externalChatId: chat.externalId,
            externalSenderId: teacherMapping.externalTeacherId,
            chatId: chat._id,
            senderId: teacherMapping.teacherId,
            content: "Silakan diskusi materi dan tugas pada channel ini.",
            createdAt: new Date(now - i * 30_000).toISOString(),
            deleted: false,
          });
        }
      } else if (chat.type === "direct") {
        const senderId = chat.participantIds?.[0];
        const senderExternal = chat.externalParticipantIds?.[0];
        if (senderId && senderExternal) {
          await ctx.db.insert("messages", {
            externalId: `msg-${chat.externalId}-1`,
            externalChatId: chat.externalId,
            externalSenderId: senderExternal,
            chatId: chat._id,
            senderId,
            content: "Halo, silakan hubungi saya jika ada kendala belajar.",
            createdAt: new Date(now - i * 20_000).toISOString(),
            deleted: false,
          });
        }
      }
    }

    return { seeded: true };
  },
});

export const seedStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const classes = await ctx.db.query("class").collect();
    const subjects = await ctx.db.query("subjects").collect();
    const subjectTeachers = await ctx.db.query("subjectTeachers").collect();
    const assignments = await ctx.db.query("assignments").collect();
    const submissions = await ctx.db.query("submissions").collect();
    const attendance = await ctx.db.query("attendance").collect();
    const announcements = await ctx.db.query("announcements").collect();
    const chats = await ctx.db.query("chats").collect();
    const messages = await ctx.db.query("messages").collect();

    const students = users.filter(
      (row) => row.role === "regular_student" || row.role === "administrative_student",
    );
    const teachers = users.filter(
      (row) => row.role === "main_teacher" || row.role === "specialized_teacher",
    );

    const studentsPerClass: Record<string, number> = {};
    for (const row of students) {
      const key = row.externalClassId ?? "unknown";
      studentsPerClass[key] = (studentsPerClass[key] ?? 0) + 1;
    }

    const teacherSubjectCoverage: Record<string, number> = {};
    for (const row of subjectTeachers) {
      const key = row.externalTeacherId ?? "unknown";
      teacherSubjectCoverage[key] = (teacherSubjectCoverage[key] ?? 0) + 1;
    }

    const uncoveredTeachers = teachers
      .map((row) => row.externalId ?? "")
      .filter((id) => (teacherSubjectCoverage[id] ?? 0) < 1);

    return {
      users: users.length,
      classes: classes.length,
      students: students.length,
      teachers: teachers.length,
      subjects: subjects.length,
      subjectTeachers: subjectTeachers.length,
      assignments: assignments.length,
      submissions: submissions.length,
      attendance: attendance.length,
      announcements: announcements.length,
      chats: chats.length,
      messages: messages.length,
      studentsPerClass,
      uncoveredTeachers,
    };
  },
});

export const importSeedJson = mutation({
  args: {
    seed: v.any(),
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const payload = args.seed as any;
    const reset = args.reset ?? true;

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid seed payload.");
    }

    const requiredArrays = [
      "classes",
      "semesters",
      "users",
      "subjects",
      "subjectTeachers",
      "assignments",
      "submissions",
      "attendance",
      "announcements",
      "chats",
      "messages",
    ];

    for (const key of requiredArrays) {
      if (!Array.isArray(payload[key])) {
        throw new Error(`Seed payload missing array: ${key}`);
      }
    }

    if (reset) {
      await clearTable(ctx, "messages");
      await clearTable(ctx, "chats");
      await clearTable(ctx, "attendance");
      await clearTable(ctx, "submissions");
      await clearTable(ctx, "assignments");
      await clearTable(ctx, "announcements");
      await clearTable(ctx, "subjectTeachers");
      await clearTable(ctx, "subjects");
      await clearTable(ctx, "users");
      await clearTable(ctx, "semesters");
      await clearTable(ctx, "class");
    }

    const classIdByExternalId = new Map<string, any>();
    const semesterIdByExternalId = new Map<string, any>();
    const userIdByExternalId = new Map<string, any>();
    const subjectIdByExternalId = new Map<string, any>();
    const chatIdByExternalId = new Map<string, any>();
    const subjectDocIdsByTeacherExternalId = new Map<string, Set<any>>();
    const subjectExternalIdsByTeacherExternalId = new Map<string, Set<string>>();
    const classExternalIdsByTeacherExternalId = new Map<string, Set<string>>();

    for (const row of payload.classes) {
      const classId = await ctx.db.insert("class", {
        externalId: row.externalId,
        name: row.name,
      });
      classIdByExternalId.set(row.externalId, classId);
    }

    for (const row of payload.semesters) {
      const semesterId = await ctx.db.insert("semesters", {
        externalId: row.externalId,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
      });
      semesterIdByExternalId.set(row.externalId, semesterId);
    }

    for (const row of payload.users) {
      const classId = classIdByExternalId.get(row.externalClassId);
      if (!classId) {
        throw new Error(`Missing class for user ${row.externalId}`);
      }

      const userId = await ctx.db.insert("users", {
        externalId: row.externalId,
        name: row.name,
        email: row.email,
        password: row.password ?? DEFAULT_PASSWORD,
        role: row.role,
        approved: Boolean(row.approved),
        classId,
        externalClassId: row.externalClassId,
        bio: row.bio ?? "",
        profileImageUrl: row.profileImageUrl,
      });
      userIdByExternalId.set(row.externalId, userId);
    }

    for (const row of payload.subjects) {
      const classId = classIdByExternalId.get(row.externalClassId);
      const teacherId = userIdByExternalId.get(row.primaryTeacherExternalId);
      if (!classId || !teacherId) {
        throw new Error(`Missing class/teacher for subject ${row.externalId}`);
      }

      const subjectId = await ctx.db.insert("subjects", {
        externalId: row.externalId,
        name: row.name,
        classId,
        externalClassId: row.externalClassId,
        teacherId,
      });
      subjectIdByExternalId.set(row.externalId, subjectId);
    }

    for (const row of payload.subjectTeachers) {
      const classId = classIdByExternalId.get(row.externalClassId);
      const subjectId = subjectIdByExternalId.get(row.externalSubjectId);
      const teacherId = userIdByExternalId.get(row.externalTeacherId);
      if (!classId || !subjectId || !teacherId) {
        throw new Error(`Invalid subjectTeachers row ${row.externalId}`);
      }

      await ctx.db.insert("subjectTeachers", {
        externalId: row.externalId,
        externalClassId: row.externalClassId,
        externalSubjectId: row.externalSubjectId,
        externalTeacherId: row.externalTeacherId,
        classId,
        subjectId,
        teacherId,
      });

      const teacherSubjectDocIds = subjectDocIdsByTeacherExternalId.get(row.externalTeacherId) ?? new Set<any>();
      teacherSubjectDocIds.add(subjectId);
      subjectDocIdsByTeacherExternalId.set(row.externalTeacherId, teacherSubjectDocIds);

      const teacherSubjectExternalIds = subjectExternalIdsByTeacherExternalId.get(row.externalTeacherId) ?? new Set<string>();
      teacherSubjectExternalIds.add(row.externalSubjectId);
      subjectExternalIdsByTeacherExternalId.set(row.externalTeacherId, teacherSubjectExternalIds);

      const teacherClassExternalIds = classExternalIdsByTeacherExternalId.get(row.externalTeacherId) ?? new Set<string>();
      teacherClassExternalIds.add(row.externalClassId);
      classExternalIdsByTeacherExternalId.set(row.externalTeacherId, teacherClassExternalIds);
    }

    for (const row of payload.users) {
      if (row.role !== "main_teacher" && row.role !== "specialized_teacher") {
        continue;
      }
      const userId = userIdByExternalId.get(row.externalId);
      const subjectDocIds = Array.from(subjectDocIdsByTeacherExternalId.get(row.externalId) ?? new Set<any>());
      const subjectExternalIds = Array.from(subjectExternalIdsByTeacherExternalId.get(row.externalId) ?? new Set<string>());
      const classExternalIds = Array.from(classExternalIdsByTeacherExternalId.get(row.externalId) ?? new Set<string>());

      await ctx.db.patch(userId, {
        subjectIds: subjectDocIds,
        externalSubjectId: subjectExternalIds[0],
        externalTaughtClassIds: classExternalIds,
      });
    }

    for (const row of payload.classes) {
      if (!row.mainTeacherExternalId) {
        continue;
      }
      const classId = classIdByExternalId.get(row.externalId);
      const mainTeacherId = userIdByExternalId.get(row.mainTeacherExternalId);
      if (classId && mainTeacherId) {
        await ctx.db.patch(classId, { mainTeacherId });
      }
    }

    const assignmentIdByExternalId = new Map<string, any>();
    for (const row of payload.assignments) {
      const assignmentId = await ctx.db.insert("assignments", {
        externalId: row.externalId,
        externalSubjectId: row.externalSubjectId,
        externalClassId: row.externalClassId,
        externalSemesterId: row.externalSemesterId,
        externalCreatedBy: row.externalCreatedBy,
        assignmentType: row.assignmentType,
        subjectId: subjectIdByExternalId.get(row.externalSubjectId),
        semesterId: semesterIdByExternalId.get(row.externalSemesterId),
        title: row.title,
        description: row.description,
        deadline: row.deadline,
        allowLate: Boolean(row.allowLate),
        allowResubmit: Boolean(row.allowResubmit),
        totalScore: row.totalScore,
        createdBy: userIdByExternalId.get(row.externalCreatedBy),
      });
      assignmentIdByExternalId.set(row.externalId, assignmentId);
    }

    for (const row of payload.submissions) {
      await ctx.db.insert("submissions", {
        externalId: row.externalId,
        externalAssignmentId: row.externalAssignmentId,
        externalStudentId: row.externalStudentId,
        submissionType: row.submissionType,
        payload: row.payload,
        assignmentId: assignmentIdByExternalId.get(row.externalAssignmentId),
        studentId: userIdByExternalId.get(row.externalStudentId),
        score: row.score,
        comment: row.comment,
        submittedAt: row.submittedAt,
        late: Boolean(row.late),
      });
    }

    for (const row of payload.attendance) {
      await ctx.db.insert("attendance", {
        externalId: row.externalId,
        externalSubjectId: row.externalSubjectId,
        externalClassId: row.externalClassId,
        externalSemesterId: row.externalSemesterId,
        externalStudentId: row.externalStudentId,
        subjectId: subjectIdByExternalId.get(row.externalSubjectId),
        semesterId: semesterIdByExternalId.get(row.externalSemesterId),
        studentId: userIdByExternalId.get(row.externalStudentId),
        date: row.date,
        status: row.status,
      });
    }

    for (const row of payload.announcements) {
      await ctx.db.insert("announcements", {
        externalId: row.externalId,
        externalCreatedBy: row.externalCreatedBy,
        externalClassId: row.externalClassId,
        title: row.title,
        content: row.content,
        createdBy: userIdByExternalId.get(row.externalCreatedBy),
        createdAt: row.createdAt,
        classId: classIdByExternalId.get(row.externalClassId),
      });
    }

    for (const row of payload.chats) {
      const chatId = await ctx.db.insert("chats", {
        externalId: row.externalId,
        externalClassId: row.externalClassId,
        externalSubjectId: row.externalSubjectId,
        externalParticipantIds: row.externalParticipantIds,
        type: row.type,
        classId: classIdByExternalId.get(row.externalClassId),
        subjectId: row.externalSubjectId ? subjectIdByExternalId.get(row.externalSubjectId) : undefined,
        participantIds: Array.isArray(row.externalParticipantIds)
          ? row.externalParticipantIds.map((id: string) => userIdByExternalId.get(id)).filter(Boolean)
          : undefined,
        createdAt: row.createdAt,
      });
      chatIdByExternalId.set(row.externalId, chatId);
    }

    for (const row of payload.messages) {
      await ctx.db.insert("messages", {
        externalId: row.externalId,
        externalChatId: row.externalChatId,
        externalSenderId: row.externalSenderId,
        chatId: chatIdByExternalId.get(row.externalChatId),
        senderId: userIdByExternalId.get(row.externalSenderId),
        content: row.content,
        createdAt: row.createdAt,
        deleted: Boolean(row.deleted),
      });
    }

    return {
      imported: true,
      counts: {
        classes: payload.classes.length,
        semesters: payload.semesters.length,
        users: payload.users.length,
        subjects: payload.subjects.length,
        subjectTeachers: payload.subjectTeachers.length,
        assignments: payload.assignments.length,
        submissions: payload.submissions.length,
        attendance: payload.attendance.length,
        announcements: payload.announcements.length,
        chats: payload.chats.length,
        messages: payload.messages.length,
      },
    };
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

    const existingMapping = await ctx.db
      .query("subjectTeachers")
      .withIndex("by_subject_teacher", (q) => q.eq("subjectId", subject._id).eq("teacherId", teacher._id))
      .first();

    if (!existingMapping) {
      await ctx.db.insert("subjectTeachers", {
        externalId: `st-${args.subjectId}-${args.teacherId}`,
        externalClassId: subject.externalClassId,
        externalSubjectId: args.subjectId,
        externalTeacherId: args.teacherId,
        classId: subject.classId,
        subjectId: subject._id,
        teacherId: teacher._id,
      });
    }

    const teacherSubjectIds = Array.from(
      new Set([...(teacher.subjectIds ?? []), subject._id]),
    );
    const teacherExternalTaughtClassIds = Array.from(
      new Set([...(teacher.externalTaughtClassIds ?? []), subject.externalClassId].filter(Boolean)),
    );

    await ctx.db.patch(teacher._id, {
      externalSubjectId: teacher.externalSubjectId ?? args.subjectId,
      subjectIds: teacherSubjectIds,
      externalTaughtClassIds: teacherExternalTaughtClassIds,
    });
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
    const updated = (await ctx.db.get(requester._id)) as any;
    if (!updated) {
      throw new Error("Unable to load updated profile.");
    }
    return toUserDto(updated);
  },
});
