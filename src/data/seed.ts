import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  ClassRoom,
  Semester,
  Subject,
  Submission,
  TeacherClassSubject,
  User,
} from "../types";

const subjectCatalog = [
  { _id: "subject-math", name: "Math" },
  { _id: "subject-english", name: "English" },
  { _id: "subject-chemistry", name: "Chemistry" },
  { _id: "subject-physics", name: "Physics" },
  { _id: "subject-biology", name: "Biology" },
  { _id: "subject-history", name: "History" },
] as const;

const classIds = [
  "class-1A",
  "class-1B",
  "class-1C",
  "class-2A",
  "class-2B",
  "class-2C",
  "class-3A",
  "class-3B",
  "class-3C",
];

const now = new Date("2026-03-03T09:00:00.000Z");

export const semesters: Semester[] = [
  {
    _id: "sem-1-2026",
    name: "Semester 1 2026",
    startDate: "2026-01-05",
    endDate: "2026-06-30",
  },
];

export const subjects: Subject[] = subjectCatalog.map((subject) => ({
  _id: subject._id,
  name: subject.name,
}));

const teacherProfiles = [
  { id: "u-main-1", name: "Mrs. Johnson", email: "johnson@school.edu", subjectId: "subject-math", mainClassId: "class-1A", taughtClassIds: ["class-1A", "class-2A"] },
  { id: "u-main-2", name: "Mr. Williams", email: "williams@school.edu", subjectId: "subject-english", mainClassId: "class-1B", taughtClassIds: ["class-1B", "class-2B"] },
  { id: "u-main-3", name: "Ms. Davis", email: "davis@school.edu", subjectId: "subject-chemistry", mainClassId: "class-1C", taughtClassIds: ["class-1C", "class-2C"] },
  { id: "u-main-4", name: "Dr. Martinez", email: "martinez@school.edu", subjectId: "subject-physics", mainClassId: "class-2A", taughtClassIds: ["class-2A", "class-3A"] },
  { id: "u-main-5", name: "Mrs. Garcia", email: "garcia@school.edu", subjectId: "subject-biology", mainClassId: "class-2B", taughtClassIds: ["class-2B", "class-3B"] },
  { id: "u-main-6", name: "Mr. Rodriguez", email: "rodriguez@school.edu", subjectId: "subject-history", mainClassId: "class-2C", taughtClassIds: ["class-2C", "class-3C"] },
  { id: "u-main-7", name: "Ms. Lee", email: "lee@school.edu", subjectId: "subject-math", mainClassId: "class-3A", taughtClassIds: ["class-3A"] },
  { id: "u-main-8", name: "Dr. Brown", email: "brown@school.edu", subjectId: "subject-english", mainClassId: "class-3B", taughtClassIds: ["class-3B"] },
  { id: "u-main-9", name: "Mrs. Taylor", email: "taylor@school.edu", subjectId: "subject-chemistry", mainClassId: "class-3C", taughtClassIds: ["class-3C"] },
  { id: "u-spec-10", name: "Ms. Clarke", email: "clarke@school.edu", subjectId: "subject-physics", mainClassId: "class-1A", taughtClassIds: ["class-1A", "class-1B", "class-1C"] },
  { id: "u-spec-11", name: "Mr. Joseph", email: "joseph@school.edu", subjectId: "subject-biology", mainClassId: "class-2A", taughtClassIds: ["class-2A", "class-2B", "class-2C"] },
  { id: "u-spec-12", name: "Mrs. Charles", email: "charles@school.edu", subjectId: "subject-history", mainClassId: "class-3A", taughtClassIds: ["class-3A", "class-3B", "class-3C"] },
];

export const classes: ClassRoom[] = classIds.map((classId, index) => ({
  _id: classId,
  name: classId.replace("class-", "Class "),
  mainTeacherId: teacherProfiles[index].id,
}));

const adminUsers: User[] = [
  {
    _id: "u-super-1",
    name: "Super Admin",
    email: "admin@school.edu",
    role: "super_admin",
    approved: true,
    classId: "class-1A",
  },
];

const teacherUsers: User[] = teacherProfiles.map((teacher) => ({
  _id: teacher.id,
  name: teacher.name,
  email: teacher.email,
  role: teacher.id.startsWith("u-main-") ? "main_teacher" : "specialized_teacher",
  approved: true,
  classId: teacher.mainClassId,
  subjectId: teacher.subjectId,
  taughtClassIds: teacher.taughtClassIds,
}));

function buildClassStudents(classId: string) {
  const classCode = classId.replace("class-", "").toLowerCase();
  const regular: User[] = Array.from({ length: 10 }).map((_, idx) => ({
    _id: `u-student-${classCode}-${idx + 1}`,
    name: `Student ${classCode.toUpperCase()}-${idx + 1}`,
    email: `student.${classCode}.${idx + 1}@school.edu`,
    role: "regular_student",
    approved: true,
    classId,
  }));
  const admins: User[] = Array.from({ length: 2 }).map((_, idx) => ({
    _id: `u-admin-student-${classCode}-${idx + 1}`,
    name: `Admin Student ${classCode.toUpperCase()}-${idx + 1}`,
    email: `admin.student.${classCode}.${idx + 1}@school.edu`,
    role: "administrative_student",
    approved: true,
    classId,
  }));
  return [...regular, ...admins];
}

const studentUsers = classIds.flatMap(buildClassStudents);

export const users: User[] = [...adminUsers, ...teacherUsers, ...studentUsers];

export const teacherClassSubjects: TeacherClassSubject[] = teacherProfiles.flatMap((teacher) =>
  teacher.taughtClassIds.map((classId) => ({
    _id: `tcs-${teacher.id}-${classId}`,
    teacherId: teacher.id,
    classId,
    subjectId: teacher.subjectId,
    isMainTeacher: teacher.mainClassId === classId,
  })),
);

const seedAssignmentDefs: Array<{
  _id: string;
  classId: string;
  subjectId: string;
  createdBy: string;
  title: string;
  deadline: string;
  allowLate: boolean;
  allowResubmit: boolean;
  assignmentType: "file" | "text" | "quiz";
}> = teacherProfiles.map((teacher, index) => {
  const classId = teacher.taughtClassIds[0];
  const subjectId = teacher.subjectId;
  const title = `Assignment ${index + 1} - ${subjects.find((subject) => subject._id === subjectId)?.name ?? "Subject"}`;
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + ((index % 5) + 2));
  return {
    _id: `as-${subjectId.replace("subject-", "")}-${classId.replace("class-", "").toLowerCase()}`,
    classId,
    subjectId,
    createdBy: teacher.id,
    title,
    deadline: deadline.toISOString(),
    allowLate: true,
    allowResubmit: true,
    assignmentType: index % 3 === 0 ? "file" : index % 3 === 1 ? "text" : "quiz",
  };
});

seedAssignmentDefs[0] = {
  _id: "as-math-1",
  classId: "class-1A",
  subjectId: "subject-math",
  createdBy: "u-main-1",
  title: "Linear Equations Worksheet",
  deadline: "2026-03-12T23:59:00.000Z",
  allowLate: true,
  allowResubmit: true,
  assignmentType: "file",
};
seedAssignmentDefs[1] = {
  _id: "as-english-1",
  classId: "class-1B",
  subjectId: "subject-english",
  createdBy: "u-main-2",
  title: "Essay on Caribbean Literature",
  deadline: "2026-01-15T23:59:00.000Z",
  allowLate: false,
  allowResubmit: false,
  assignmentType: "text",
};

export const assignments: Assignment[] = seedAssignmentDefs.map((item, index) => ({
  _id: item._id,
  subjectId: item.subjectId,
  classId: item.classId,
  semesterId: "sem-1-2026",
  title: item.title,
  description: `Complete ${item.title.toLowerCase()} and submit before the deadline.`,
  deadline: item.deadline,
  allowLate: item.allowLate,
  allowResubmit: item.allowResubmit,
  totalScore: 100,
  createdBy: item.createdBy,
  assignmentType: item.assignmentType,
  attachments: index % 2 === 0 ? [`material-${index + 1}.pdf`] : undefined,
}));

const classStudentMap = new Map(
  classIds.map((classId) => [
    classId,
    users.filter(
      (user) =>
        user.classId === classId &&
        (user.role === "regular_student" || user.role === "administrative_student"),
    ),
  ]),
);

const generatedSubmissions: Submission[] = assignments.flatMap((assignment, assignmentIndex) => {
  const classStudents = classStudentMap.get(assignment.classId) ?? [];
  return classStudents.slice(0, 6).map((student, studentIndex) => {
    const graded = studentIndex % 3 !== 0;
    const submittedAt = new Date(now);
    submittedAt.setDate(submittedAt.getDate() - ((assignmentIndex + studentIndex) % 4));
    const score = graded ? 64 + ((assignmentIndex * 9 + studentIndex * 4) % 36) : undefined;
    return {
      _id: `subm-${assignment._id}-${student._id}`,
      assignmentId: assignment._id,
      studentId: student._id,
      submissionType: assignment.assignmentType,
      payload:
        assignment.assignmentType === "file"
          ? `${assignment._id}-${student._id}.pdf`
          : assignment.assignmentType === "quiz"
            ? "A, C, B, D, Essay: detailed answer"
            : `Submission for ${assignment.title}`,
      score,
      comment: typeof score === "number" ? "Good effort, keep improving." : undefined,
      submittedAt: submittedAt.toISOString(),
      late: submittedAt > new Date(assignment.deadline),
    };
  });
});

const compatibilitySubmission = generatedSubmissions.find(
  (row) => row.assignmentId === "as-english-1",
);
if (compatibilitySubmission) {
  compatibilitySubmission._id = "subm-3";
  compatibilitySubmission.score = 81;
  compatibilitySubmission.comment = "Solid argument and examples.";
}

export const submissions: Submission[] = generatedSubmissions;

export const attendance: AttendanceRecord[] = teacherClassSubjects.flatMap((mapping, mapIndex) => {
  const classStudents = classStudentMap.get(mapping.classId) ?? [];
  return classStudents.slice(0, 8).flatMap((student, index) => {
    const dayOne = new Date(now);
    dayOne.setDate(dayOne.getDate() - 1);
    const dayTwo = new Date(now);
    const statuses = ["Present", "Absent", "Excused"] as const;
    return [
      {
        _id: `att-${mapping._id}-${student._id}-1`,
        subjectId: mapping.subjectId,
        classId: mapping.classId,
        semesterId: "sem-1-2026",
        studentId: student._id,
        date: dayOne.toISOString().slice(0, 10),
        status: statuses[(index + mapIndex) % statuses.length],
      },
      {
        _id: `att-${mapping._id}-${student._id}-2`,
        subjectId: mapping.subjectId,
        classId: mapping.classId,
        semesterId: "sem-1-2026",
        studentId: student._id,
        date: dayTwo.toISOString().slice(0, 10),
        status: statuses[(index + mapIndex + 1) % statuses.length],
      },
    ];
  });
});

export const announcements: Announcement[] = classIds.flatMap((classId, idx) => [
  {
    _id: `ann-${classId}-1`,
    title: `Weekly update for ${classId.replace("class-", "")}`,
    content: "Please review assignment deadlines and attendance policy updates.",
    createdBy: classes[idx].mainTeacherId,
    createdAt: new Date(now.getTime() - idx * 3600_000).toISOString(),
    classId,
  },
  {
    _id: `ann-${classId}-2`,
    title: `Student council notice ${classId.replace("class-", "")}`,
    content: "Administrative students should submit event proposals by Friday.",
    createdBy: (classStudentMap.get(classId) ?? []).find(
      (student) => student.role === "administrative_student",
    )?._id ?? classes[idx].mainTeacherId,
    createdAt: new Date(now.getTime() - (idx + 9) * 3600_000).toISOString(),
    classId,
  },
]);
