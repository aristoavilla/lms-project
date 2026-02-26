import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  ClassRoom,
  Semester,
  Subject,
  Submission,
  User,
} from "../types";

export const semesters: Semester[] = [
  {
    _id: "sem-1-2026",
    name: "Semester 1 2026",
    startDate: "2026-01-05",
    endDate: "2026-06-30",
  },
];

export const classes: ClassRoom[] = [
  { _id: "class-10A", name: "Grade 10A", mainTeacherId: "u-main-1" },
];

export const users: User[] = [
  {
    _id: "u-super-1",
    name: "Super Admin",
    email: "admin@school.edu",
    role: "super_admin",
    approved: true,
    classId: "class-10A",
  },
  {
    _id: "u-main-1",
    name: "Homeroom Teacher",
    email: "homeroom@school.edu",
    role: "main_teacher",
    approved: true,
    classId: "class-10A",
    subjectIds: ["sub-math"],
  },
  {
    _id: "u-spec-eng",
    name: "English Teacher",
    email: "english@school.edu",
    role: "specialized_teacher",
    approved: true,
    classId: "class-10A",
    subjectIds: ["sub-english"],
  },
  {
    _id: "u-admin-student-1",
    name: "Administrative Student",
    email: "admin.student@school.edu",
    role: "administrative_student",
    approved: true,
    classId: "class-10A",
  },
  {
    _id: "u-student-1",
    name: "Alicia Joseph",
    email: "alicia@student.school.edu",
    role: "regular_student",
    approved: true,
    classId: "class-10A",
  },
  {
    _id: "u-student-2",
    name: "Brian George",
    email: "brian@student.school.edu",
    role: "regular_student",
    approved: true,
    classId: "class-10A",
  },
  {
    _id: "u-student-3",
    name: "Chloe Francis",
    email: "chloe@student.school.edu",
    role: "regular_student",
    approved: true,
    classId: "class-10A",
  },
  {
    _id: "u-student-pending",
    name: "Pending Student",
    email: "pending@student.school.edu",
    role: "regular_student",
    approved: false,
    classId: "class-10A",
  },
];

export const subjects: Subject[] = [
  { _id: "sub-math", name: "Math", classId: "class-10A", teacherId: "u-main-1" },
  {
    _id: "sub-english",
    name: "English",
    classId: "class-10A",
    teacherId: "u-spec-eng",
  },
  {
    _id: "sub-chemistry",
    name: "Chemistry",
    classId: "class-10A",
    teacherId: "u-main-1",
  },
  {
    _id: "sub-physics",
    name: "Physics",
    classId: "class-10A",
    teacherId: "u-main-1",
  },
  {
    _id: "sub-biology",
    name: "Biology",
    classId: "class-10A",
    teacherId: "u-main-1",
  },
  {
    _id: "sub-history",
    name: "History",
    classId: "class-10A",
    teacherId: "u-main-1",
  },
];

export const assignments: Assignment[] = [
  {
    _id: "as-math-1",
    subjectId: "sub-math",
    semesterId: "sem-1-2026",
    title: "Linear Equations Worksheet",
    description: "Submit worked solutions for all 10 questions.",
    deadline: "2026-03-10T23:59:00.000Z",
    allowLate: true,
    allowResubmit: true,
    totalScore: 100,
    createdBy: "u-main-1",
    assignmentType: "file",
  },
  {
    _id: "as-english-1",
    subjectId: "sub-english",
    semesterId: "sem-1-2026",
    title: "Essay on Caribbean Literature",
    description: "Write 600 words and submit in text format.",
    deadline: "2026-01-15T23:59:00.000Z",
    allowLate: false,
    allowResubmit: false,
    totalScore: 100,
    createdBy: "u-spec-eng",
    assignmentType: "text",
  },
];

export const submissions: Submission[] = [
  {
    _id: "subm-1",
    assignmentId: "as-math-1",
    studentId: "u-student-1",
    submissionType: "file",
    payload: "worksheet-alicia.pdf",
    score: 87,
    comment: "Good process. Verify Q7.",
    submittedAt: "2026-03-09T12:00:00.000Z",
    late: false,
  },
  {
    _id: "subm-2",
    assignmentId: "as-math-1",
    studentId: "u-student-2",
    submissionType: "file",
    payload: "worksheet-brian.pdf",
    score: 92,
    comment: "Accurate and clean.",
    submittedAt: "2026-03-08T10:00:00.000Z",
    late: false,
  },
  {
    _id: "subm-3",
    assignmentId: "as-english-1",
    studentId: "u-student-1",
    submissionType: "text",
    payload: "My essay body...",
    score: 81,
    comment: "Solid argument and examples.",
    submittedAt: "2026-03-14T08:30:00.000Z",
    late: false,
  },
];

export const attendance: AttendanceRecord[] = [
  {
    _id: "att-1",
    subjectId: "sub-math",
    semesterId: "sem-1-2026",
    studentId: "u-student-1",
    date: "2026-03-01",
    status: "Present",
  },
  {
    _id: "att-2",
    subjectId: "sub-math",
    semesterId: "sem-1-2026",
    studentId: "u-student-2",
    date: "2026-03-01",
    status: "Absent",
  },
  {
    _id: "att-3",
    subjectId: "sub-english",
    semesterId: "sem-1-2026",
    studentId: "u-student-1",
    date: "2026-03-01",
    status: "Excused",
  },
];

export const announcements: Announcement[] = [
  {
    _id: "ann-1",
    title: "Mid-term Schedule",
    content: "Exams start on March 20. Check each subject for timing.",
    createdBy: "u-main-1",
    createdAt: "2026-03-01T09:00:00.000Z",
    classId: "class-10A",
  },
  {
    _id: "ann-2",
    title: "Essay Tips Session",
    content: "Optional writing clinic this Friday at 2 PM.",
    createdBy: "u-spec-eng",
    createdAt: "2026-03-02T12:00:00.000Z",
    classId: "class-10A",
  },
];
