import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CLASS_CODES = ["1A", "1B", "1C", "2A", "2B", "2C", "3A", "3B", "3C"];
const SUBJECT_CATALOG = [
  { key: "matematika", label: "Matematika" },
  { key: "bahasa-indonesia", label: "Bahasa Indonesia" },
  { key: "ipa", label: "IPA" },
  { key: "bahasa-inggris", label: "Bahasa Inggris" },
  { key: "sejarah", label: "Sejarah" },
  { key: "informatika", label: "Informatika" },
];

const FIRST = [
  "Ahmad", "Budi", "Rizky", "Dimas", "Fajar", "Andi", "Arif", "Bayu", "Rendra", "Wahyu",
  "Ari", "Yoga", "Hendra", "Deni", "Rafi", "Ilham", "Reza", "Fikri", "Adit", "Eko",
  "Rina", "Siti", "Dewi", "Ayu", "Nadia", "Putri", "Lestari", "Fitri", "Indah", "Maya",
  "Wulan", "Nisa", "Amelia", "Rahma", "Kartika", "Citra", "Puspita", "Desi", "Nabila", "Tika",
  "Salsa", "Novi", "Annisa", "Intan", "Niken", "Rara", "Yuni", "Tiara", "Vina", "Mila",
];

const LAST = [
  "Saputra", "Pratama", "Wijaya", "Nugroho", "Santoso", "Setiawan", "Hidayat", "Permana", "Kusuma", "Firmansyah",
  "Ramadhan", "Syahputra", "Maulana", "Utami", "Lestari", "Anggraini", "Sari", "Wati", "Handayani", "Puspitasari",
  "Safitri", "Aulia", "Kurniawan", "Purnama", "Gunawan", "Pangestu", "Hermawan", "Saputri", "Rahmawati", "Iskandar",
];

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".");
}

function uniqueNameGenerator() {
  let index = 0;
  const seen = new Set();
  return () => {
    while (index < FIRST.length * LAST.length) {
      const first = FIRST[Math.floor(index / LAST.length)];
      const last = LAST[index % LAST.length];
      index += 1;
      const full = `${first} ${last}`;
      if (!seen.has(full)) {
        seen.add(full);
        return full;
      }
    }
    throw new Error("Name pool exhausted.");
  };
}

const nextName = uniqueNameGenerator();
const emailCounter = new Map();

function createEmail(name, bucket) {
  const base = `${slugifyName(name)}.${bucket.toLowerCase()}`;
  const count = (emailCounter.get(base) ?? 0) + 1;
  emailCounter.set(base, count);
  return `${base}${count}@school.edu`;
}

const now = Date.now();
const defaultPassword = "Password123!";

const seed = {
  classes: [],
  semesters: [
    { externalId: "sem-1-2026", name: "Semester 1 2026", startDate: "2026-01-05", endDate: "2026-06-30" },
    { externalId: "sem-2-2026", name: "Semester 2 2026", startDate: "2026-07-15", endDate: "2026-12-15" },
  ],
  users: [],
  subjects: [],
  subjectTeachers: [],
  assignments: [],
  submissions: [],
  attendance: [],
  announcements: [],
  chats: [],
  messages: [],
};

const mainTeacherByClass = new Map();
const studentsByClass = new Map();
const teacherSubjectExternalIds = new Map();
const teacherClassExternalIds = new Map();
const allTeacherExternalIds = [];
const specializedTeacherExternalIds = [];
const seededSubjects = [];

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  seed.classes.push({ externalId: externalClassId, name: `Class ${classCode}` });
  studentsByClass.set(externalClassId, []);
}

seed.users.push({
  externalId: "u-super-1",
  name: "Budi Santoso",
  email: "admin@school.edu",
  password: defaultPassword,
  role: "super_admin",
  approved: true,
  externalClassId: "class-1A",
  bio: "Super administrator sistem LMS.",
});

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  const externalId = `u-main-${classCode.toLowerCase()}`;
  const name = nextName();
  seed.users.push({
    externalId,
    name,
    email: createEmail(name, `main.${classCode}`),
    password: defaultPassword,
    role: "main_teacher",
    approved: true,
    externalClassId,
    bio: "Wali kelas dan pengajar utama.",
  });
  mainTeacherByClass.set(externalClassId, externalId);
  allTeacherExternalIds.push(externalId);
  teacherClassExternalIds.set(externalId, new Set([externalClassId]));
}

for (let i = 0; i < 12; i += 1) {
  const classCode = CLASS_CODES[i % CLASS_CODES.length];
  const externalClassId = `class-${classCode}`;
  const externalId = `u-spec-${String(i + 1).padStart(2, "0")}`;
  const name = nextName();
  seed.users.push({
    externalId,
    name,
    email: createEmail(name, `spec.${i + 1}`),
    password: defaultPassword,
    role: "specialized_teacher",
    approved: true,
    externalClassId,
    bio: "Guru mata pelajaran lintas kelas.",
  });
  specializedTeacherExternalIds.push(externalId);
  allTeacherExternalIds.push(externalId);
  teacherClassExternalIds.set(externalId, new Set([externalClassId]));
}

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  const list = studentsByClass.get(externalClassId);
  for (let n = 1; n <= 30; n += 1) {
    const role = n % 10 === 0 ? "administrative_student" : "regular_student";
    const externalId = `${role === "administrative_student" ? "u-admin-student" : "u-student"}-${classCode.toLowerCase()}-${String(n).padStart(2, "0")}`;
    const name = nextName();
    seed.users.push({
      externalId,
      name,
      email: createEmail(name, `student.${classCode}`),
      password: defaultPassword,
      role,
      approved: true,
      externalClassId,
      bio: "Siswa aktif pada tahun ajaran 2026.",
    });
    list.push({ externalId, name });
  }
}

for (let classIndex = 0; classIndex < CLASS_CODES.length; classIndex += 1) {
  const classCode = CLASS_CODES[classIndex];
  const externalClassId = `class-${classCode}`;
  const mainTeacherExternalId = mainTeacherByClass.get(externalClassId);

  for (let subjectIndex = 0; subjectIndex < SUBJECT_CATALOG.length; subjectIndex += 1) {
    const subjectMeta = SUBJECT_CATALOG[subjectIndex];
    const subjectExternalId = `subject-${subjectMeta.key}-${classCode.toLowerCase()}`;
    const primaryTeacherExternalId =
      subjectIndex < 3
        ? mainTeacherExternalId
        : specializedTeacherExternalIds[(classIndex + subjectIndex) % specializedTeacherExternalIds.length];

    const coTeacherExternalId =
      subjectIndex < 3
        ? specializedTeacherExternalIds[(classIndex + subjectIndex + 2) % specializedTeacherExternalIds.length]
        : mainTeacherExternalId;

    seed.subjects.push({
      externalId: subjectExternalId,
      name: subjectMeta.label,
      externalClassId,
      primaryTeacherExternalId,
    });

    const primaryMapId = `st-${subjectExternalId}-${primaryTeacherExternalId}`;
    seed.subjectTeachers.push({
      externalId: primaryMapId,
      externalClassId,
      externalSubjectId: subjectExternalId,
      externalTeacherId: primaryTeacherExternalId,
    });

    const primarySubjects = teacherSubjectExternalIds.get(primaryTeacherExternalId) ?? new Set();
    primarySubjects.add(subjectExternalId);
    teacherSubjectExternalIds.set(primaryTeacherExternalId, primarySubjects);
    teacherClassExternalIds.get(primaryTeacherExternalId).add(externalClassId);

    if (coTeacherExternalId !== primaryTeacherExternalId) {
      const coMapId = `st-${subjectExternalId}-${coTeacherExternalId}`;
      seed.subjectTeachers.push({
        externalId: coMapId,
        externalClassId,
        externalSubjectId: subjectExternalId,
        externalTeacherId: coTeacherExternalId,
      });
      const coSubjects = teacherSubjectExternalIds.get(coTeacherExternalId) ?? new Set();
      coSubjects.add(subjectExternalId);
      teacherSubjectExternalIds.set(coTeacherExternalId, coSubjects);
      teacherClassExternalIds.get(coTeacherExternalId).add(externalClassId);
    }

    seededSubjects.push({
      externalId: subjectExternalId,
      externalClassId,
      name: subjectMeta.label,
      primaryTeacherExternalId,
    });
  }
}

for (let i = 0; i < allTeacherExternalIds.length; i += 1) {
  const teacherExternalId = allTeacherExternalIds[i];
  const assigned = teacherSubjectExternalIds.get(teacherExternalId);
  if (assigned && assigned.size > 0) {
    continue;
  }
  const fallbackClassExternalId = `class-${CLASS_CODES[i % CLASS_CODES.length]}`;
  const fallbackSubject = seededSubjects.find((row) => row.externalClassId === fallbackClassExternalId);
  if (!fallbackSubject) {
    continue;
  }
  seed.subjectTeachers.push({
    externalId: `st-${fallbackSubject.externalId}-${teacherExternalId}`,
    externalClassId: fallbackClassExternalId,
    externalSubjectId: fallbackSubject.externalId,
    externalTeacherId: teacherExternalId,
  });
  const set = teacherSubjectExternalIds.get(teacherExternalId) ?? new Set();
  set.add(fallbackSubject.externalId);
  teacherSubjectExternalIds.set(teacherExternalId, set);
  teacherClassExternalIds.get(teacherExternalId).add(fallbackClassExternalId);
}

const userByExternalId = new Map(seed.users.map((u) => [u.externalId, u]));
for (const teacherExternalId of allTeacherExternalIds) {
  const teacher = userByExternalId.get(teacherExternalId);
  if (!teacher) continue;
  const subjectsSet = teacherSubjectExternalIds.get(teacherExternalId) ?? new Set();
  const taughtClassesSet = teacherClassExternalIds.get(teacherExternalId) ?? new Set();
  teacher.externalSubjectId = Array.from(subjectsSet)[0];
  teacher.externalTaughtClassIds = Array.from(taughtClassesSet);
}

for (let i = 0; i < seededSubjects.length; i += 1) {
  const subject = seededSubjects[i];
  const assignmentExternalId = `as-${subject.externalId}-1`;
  seed.assignments.push({
    externalId: assignmentExternalId,
    externalSubjectId: subject.externalId,
    externalClassId: subject.externalClassId,
    externalSemesterId: "sem-1-2026",
    externalCreatedBy: subject.primaryTeacherExternalId,
    assignmentType: "text",
    title: `Tugas ${subject.name} ${subject.externalClassId.replace("class-", "")}`,
    description: `Kerjakan latihan ${subject.name} dan kumpulkan tepat waktu.`,
    deadline: "2026-04-15T23:59:00.000Z",
    allowLate: true,
    allowResubmit: true,
    totalScore: 100,
  });

  const classStudents = studentsByClass.get(subject.externalClassId) ?? [];
  for (let s = 0; s < Math.min(10, classStudents.length); s += 1) {
    const student = classStudents[s];
    seed.submissions.push({
      externalId: `subm-${assignmentExternalId}-${student.externalId}`,
      externalAssignmentId: assignmentExternalId,
      externalStudentId: student.externalId,
      submissionType: "text",
      payload: `Jawaban tugas oleh ${student.name}`,
      submittedAt: new Date(now - (s + i) * 3600_000).toISOString(),
      late: false,
      score: 70 + ((s * 3 + i) % 31),
      comment: "Sudah cukup baik, tingkatkan konsistensi.",
    });
  }
}

for (let i = 0; i < seededSubjects.length; i += 1) {
  const subject = seededSubjects[i];
  const classStudents = studentsByClass.get(subject.externalClassId) ?? [];
  const date = `2026-03-${String((i % 20) + 1).padStart(2, "0")}`;
  for (let s = 0; s < Math.min(15, classStudents.length); s += 1) {
    const student = classStudents[s];
    const status = s % 9 === 0 ? "Excused" : s % 5 === 0 ? "Absent" : "Present";
    seed.attendance.push({
      externalId: `att-${subject.externalId}-${student.externalId}-${date}`,
      externalSubjectId: subject.externalId,
      externalClassId: subject.externalClassId,
      externalSemesterId: "sem-1-2026",
      externalStudentId: student.externalId,
      date,
      status,
    });
  }
}

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  const mainTeacherExternalId = mainTeacherByClass.get(externalClassId);
  for (let n = 1; n <= 2; n += 1) {
    seed.announcements.push({
      externalId: `ann-${externalClassId}-${n}`,
      externalCreatedBy: mainTeacherExternalId,
      externalClassId,
      title: `Pengumuman ${n} Kelas ${classCode}`,
      content: `Informasi akademik kelas ${classCode} untuk pekan ke-${n}.`,
      createdAt: new Date(now - n * 86_400_000).toISOString(),
    });
  }
}

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  seed.chats.push({
    externalId: `chat-class-${classCode.toLowerCase()}`,
    externalClassId,
    type: "class",
    createdAt: new Date(now - 10_000).toISOString(),
  });
}

for (const subject of seededSubjects) {
  seed.chats.push({
    externalId: `chat-subject-${subject.externalId}`,
    externalClassId: subject.externalClassId,
    externalSubjectId: subject.externalId,
    type: "subject",
    createdAt: new Date(now - 8_000).toISOString(),
  });
}

for (const classCode of CLASS_CODES) {
  const externalClassId = `class-${classCode}`;
  const classStudents = studentsByClass.get(externalClassId) ?? [];
  const firstStudent = classStudents[0];
  if (!firstStudent) continue;
  const mainTeacherExternalId = mainTeacherByClass.get(externalClassId);
  seed.chats.push({
    externalId: `chat-direct-${classCode.toLowerCase()}-1`,
    externalClassId,
    externalParticipantIds: [mainTeacherExternalId, firstStudent.externalId],
    type: "direct",
    createdAt: new Date(now - 7_000).toISOString(),
  });
}

for (let i = 0; i < seed.chats.length; i += 1) {
  const chat = seed.chats[i];
  if (chat.type === "class") {
    const classCode = (chat.externalClassId ?? "class-1A").replace("class-", "");
    const mainTeacherExternalId = mainTeacherByClass.get(chat.externalClassId ?? "class-1A");
    seed.messages.push({
      externalId: `msg-${chat.externalId}-1`,
      externalChatId: chat.externalId,
      externalSenderId: mainTeacherExternalId,
      content: `Selamat datang di grup kelas ${classCode}.`,
      createdAt: new Date(now - i * 50_000).toISOString(),
      deleted: false,
    });
  } else if (chat.type === "subject") {
    const teacher = seed.subjectTeachers.find((row) => row.externalSubjectId === chat.externalSubjectId);
    if (teacher) {
      seed.messages.push({
        externalId: `msg-${chat.externalId}-1`,
        externalChatId: chat.externalId,
        externalSenderId: teacher.externalTeacherId,
        content: "Silakan diskusi materi dan tugas pada channel ini.",
        createdAt: new Date(now - i * 30_000).toISOString(),
        deleted: false,
      });
    }
  } else if (chat.type === "direct") {
    const senderExternal = chat.externalParticipantIds?.[0];
    if (senderExternal) {
      seed.messages.push({
        externalId: `msg-${chat.externalId}-1`,
        externalChatId: chat.externalId,
        externalSenderId: senderExternal,
        content: "Halo, silakan hubungi saya jika ada kendala belajar.",
        createdAt: new Date(now - i * 20_000).toISOString(),
        deleted: false,
      });
    }
  }
}

for (const classRow of seed.classes) {
  classRow.mainTeacherExternalId = mainTeacherByClass.get(classRow.externalId);
}

const outputDir = resolve(process.cwd(), "seed");
mkdirSync(outputDir, { recursive: true });
const outputPath = resolve(outputDir, "convex-seed.json");
writeFileSync(outputPath, JSON.stringify(seed, null, 2), "utf8");

console.log(`Generated seed JSON at ${outputPath}`);
console.log(`Counts: users=${seed.users.length}, classes=${seed.classes.length}, subjects=${seed.subjects.length}, subjectTeachers=${seed.subjectTeachers.length}`);
