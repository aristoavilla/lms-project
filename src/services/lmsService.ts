import {
  announcements,
  assignments,
  attendance,
  classes,
  semesters,
  subjects,
  submissions,
  teacherClassSubjects,
  users,
} from "../data/seed";
import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  RankedStudent,
  Submission,
  TeacherClassSubject,
  User,
} from "../types";
import { canManageAnnouncements, canViewOverallRanking, canViewRanking } from "../utils/rbac";
import { calculateOverallRanking, calculateSubjectRanking } from "../utils/ranking";

let announcementState = [...announcements];
let submissionState = [...submissions];
let attendanceState = [...attendance];
let userState = [...users];
let assignmentState = [...assignments];

function delay(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStudent(user: User) {
  return user.role === "regular_student" || user.role === "administrative_student";
}

function teacherMappings(user: User) {
  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return [] as TeacherClassSubject[];
  }
  return teacherClassSubjects.filter((mapping) => mapping.teacherId === user._id);
}

function teacherClassIds(user: User) {
  const mappingIds = teacherMappings(user).map((mapping) => mapping.classId);
  if (mappingIds.length > 0) {
    return Array.from(new Set(mappingIds));
  }
  return user.taughtClassIds ?? [];
}

function teacherOwnSubjectId(user: User) {
  return user.subjectId ?? null;
}

function studentsByClass(classId: string) {
  return userState.filter((candidate) => candidate.classId === classId && isStudent(candidate));
}

export function currentUserQuery(userId: string) {
  return userState.find((user) => user._id === userId);
}

export function getAllUsers() {
  return userState;
}

export function getAllClasses() {
  return classes;
}

export function getTeacherClasses(user: User) {
  const ids = teacherClassIds(user);
  return classes.filter((row) => ids.includes(row._id));
}

export async function listSubjectsByClass(classId: string) {
  await delay();
  if (!classId) {
    return subjects;
  }
  const subjectIds = teacherClassSubjects
    .filter((mapping) => mapping.classId === classId)
    .map((mapping) => mapping.subjectId);
  const uniqueIds = Array.from(new Set(subjectIds));
  return subjects.filter((subject) => uniqueIds.includes(subject._id));
}

export async function listAssignmentsForUser(user: User) {
  await delay();
  if (user.role === "super_admin") {
    return assignmentState;
  }
  if (isStudent(user)) {
    return assignmentState.filter((assignment) => assignment.classId === user.classId);
  }
  const classIds = teacherClassIds(user);
  const subjectId = teacherOwnSubjectId(user);
  return assignmentState.filter(
    (assignment) =>
      classIds.includes(assignment.classId) &&
      (subjectId ? assignment.subjectId === subjectId : true),
  );
}

export async function createAssignment(
  teacher: User,
  input: Pick<
    Assignment,
    "title" | "description" | "subjectId" | "classId" | "deadline" | "totalScore"
  >,
) {
  await delay();
  if (teacher.role !== "main_teacher" && teacher.role !== "specialized_teacher") {
    throw new Error("Only teachers can create assignments.");
  }
  if (teacher.subjectId && teacher.subjectId !== input.subjectId) {
    throw new Error("Teacher can only create assignment for their own subject.");
  }
  if (!teacherClassIds(teacher).includes(input.classId)) {
    throw new Error("Teacher can only create assignment for classes they teach.");
  }
  assignmentState = [
    {
      _id: `as-${Date.now()}`,
      subjectId: input.subjectId,
      classId: input.classId,
      semesterId: semesters[0]._id,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      allowLate: true,
      allowResubmit: true,
      totalScore: input.totalScore,
      createdBy: teacher._id,
      assignmentType: "text",
    },
    ...assignmentState,
  ];
}

export async function listAnnouncementsForClass(classId: string) {
  await delay();
  return announcementState
    .filter((announcement) => announcement.classId === classId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function createAnnouncement(
  user: User,
  input: Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
) {
  await delay();
  if (!canManageAnnouncements(user)) {
    throw new Error("You do not have permission to create announcements.");
  }
  const created: Announcement = {
    _id: `ann-${Date.now()}`,
    title: input.title,
    content: input.content,
    attachment: input.attachment,
    scheduledAt: input.scheduledAt,
    createdBy: user._id,
    createdAt: new Date().toISOString(),
    classId: user.classId,
  };
  announcementState = [created, ...announcementState];
  return created;
}

export async function updateAnnouncement(
  user: User,
  announcementId: string,
  patch: Pick<Announcement, "title" | "content">,
) {
  await delay();
  const current = announcementState.find((item) => item._id === announcementId);
  if (!current) {
    throw new Error("Announcement not found.");
  }
  if (current.createdBy !== user._id) {
    throw new Error("You can edit only your own announcements.");
  }
  announcementState = announcementState.map((item) =>
    item._id === announcementId ? { ...item, ...patch } : item,
  );
}

export async function deleteAnnouncement(user: User, announcementId: string) {
  await delay();
  const current = announcementState.find((item) => item._id === announcementId);
  if (!current) {
    throw new Error("Announcement not found.");
  }
  if (current.createdBy !== user._id) {
    throw new Error("You can delete only your own announcements.");
  }
  announcementState = announcementState.filter((item) => item._id !== announcementId);
}

export async function submitAssignment(
  user: User,
  assignmentId: string,
  payload: string,
  submissionType: Submission["submissionType"],
) {
  await delay();
  if (!isStudent(user)) {
    throw new Error("Only students can submit assignments.");
  }

  const assignment = assignmentState.find((item) => item._id === assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  if (assignment.classId !== user.classId) {
    throw new Error("Assignment is not available for this student class.");
  }

  const now = new Date();
  const isLate = now > new Date(assignment.deadline);
  if (isLate && !assignment.allowLate) {
    throw new Error("Late submission is not allowed for this assignment.");
  }

  const existing = submissionState.find(
    (item) => item.assignmentId === assignmentId && item.studentId === user._id,
  );
  if (existing && !assignment.allowResubmit) {
    throw new Error("Resubmission is not allowed for this assignment.");
  }

  if (existing) {
    submissionState = submissionState.map((item) =>
      item._id === existing._id
        ? {
            ...item,
            payload,
            submissionType,
            submittedAt: now.toISOString(),
            late: isLate,
          }
        : item,
    );
    return;
  }

  submissionState = [
    ...submissionState,
    {
      _id: `subm-${Date.now()}`,
      assignmentId,
      studentId: user._id,
      payload,
      submissionType,
      submittedAt: now.toISOString(),
      late: isLate,
    },
  ];
}

export async function gradeSubmission(
  teacher: User,
  submissionId: string,
  score: number,
  comment: string,
) {
  await delay();
  const submission = submissionState.find((item) => item._id === submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }
  const assignment = assignmentState.find((item) => item._id === submission.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  const classAllowed = teacherClassIds(teacher).includes(assignment.classId);
  const subjectAllowed = teacher.subjectId === assignment.subjectId;
  const canGrade =
    (teacher.role === "main_teacher" || teacher.role === "specialized_teacher") &&
    classAllowed &&
    subjectAllowed;
  if (!canGrade) {
    throw new Error("Not authorized to grade this submission.");
  }
  if (score < 0 || score > 100) {
    throw new Error("Score must be between 0 and 100.");
  }
  submissionState = submissionState.map((item) =>
    item._id === submissionId ? { ...item, score, comment } : item,
  );
}

export async function listAttendance(user: User) {
  await delay();
  if (isStudent(user)) {
    return attendanceState.filter((record) => record.studentId === user._id);
  }
  if (user.role === "specialized_teacher") {
    const classIds = teacherClassIds(user);
    return attendanceState.filter(
      (record) =>
        classIds.includes(record.classId) &&
        (user.subjectId ? record.subjectId === user.subjectId : true),
    );
  }
  if (user.role === "main_teacher") {
    const classIds = teacherClassIds(user);
    return attendanceState.filter(
      (record) =>
        record.classId === user.classId ||
        (classIds.includes(record.classId) &&
          (user.subjectId ? record.subjectId === user.subjectId : true)),
    );
  }
  return attendanceState;
}

export async function markAttendance(
  teacher: User,
  input: Omit<AttendanceRecord, "_id" | "semesterId">,
) {
  await delay();
  if (teacher.role !== "main_teacher" && teacher.role !== "specialized_teacher") {
    throw new Error("Only teachers can mark attendance.");
  }
  if (teacher.subjectId && input.subjectId !== teacher.subjectId) {
    throw new Error("Teacher can only mark attendance for their own subject.");
  }
  if (!teacherClassIds(teacher).includes(input.classId)) {
    throw new Error("Teacher can only mark attendance for their taught classes.");
  }
  const student = userState.find((candidate) => candidate._id === input.studentId);
  if (!student || student.classId !== input.classId || !isStudent(student)) {
    throw new Error("Student not found in selected class.");
  }
  attendanceState = [
    ...attendanceState.filter(
      (row) =>
        !(
          row.subjectId === input.subjectId &&
          row.studentId === input.studentId &&
          row.classId === input.classId &&
          row.date === input.date
        ),
    ),
    {
      ...input,
      _id: `att-${Date.now()}-${input.studentId}`,
      semesterId: semesters[0]._id,
    },
  ];
}

export async function getSubjectRanking(
  user: User,
  subjectId: string,
  classId: string,
): Promise<RankedStudent[]> {
  await delay();
  if (!canViewRanking(user)) {
    throw new Error("Ranking is blocked for students.");
  }
  if (user.role === "specialized_teacher") {
    if (user.subjectId !== subjectId) {
      throw new Error("Specialized teacher can only view their subject ranking.");
    }
    if (!teacherClassIds(user).includes(classId)) {
      throw new Error("Specialized teacher can only view classes they teach.");
    }
  }
  if (user.role === "main_teacher") {
    const classAllowed = classId === user.classId || teacherClassIds(user).includes(classId);
    const subjectAllowed = classId === user.classId ? true : user.subjectId === subjectId;
    if (!classAllowed || !subjectAllowed) {
      throw new Error("Main teacher cannot view this class/subject ranking.");
    }
  }

  const classStudents = studentsByClass(classId);
  const classAssignments = assignmentState.filter(
    (assignment) => assignment.classId === classId && assignment.subjectId === subjectId,
  );
  return calculateSubjectRanking(subjectId, classAssignments, submissionState, classStudents);
}

export async function getOverallRanking(user: User, classId?: string) {
  await delay();
  if (!canViewOverallRanking(user)) {
    throw new Error("Only Main Teacher can access overall ranking.");
  }
  const effectiveClassId =
    user.role === "main_teacher" ? user.classId : classId ?? classes[0]?._id ?? user.classId;
  const classStudents = studentsByClass(effectiveClassId);
  const classAssignments = assignmentState.filter(
    (assignment) => assignment.classId === effectiveClassId,
  );
  return calculateOverallRanking(classAssignments, submissionState, classStudents);
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  await delay();
  return submissionState.filter((submission) => submission.assignmentId === assignmentId);
}

export async function getSubmissionDetail(teacher: User, submissionId: string) {
  await delay();
  const submission = submissionState.find((item) => item._id === submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }
  const assignment = assignmentState.find((item) => item._id === submission.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  const student = userState.find((item) => item._id === submission.studentId);
  if (!student) {
    throw new Error("Student not found.");
  }
  if (teacher.role !== "main_teacher" && teacher.role !== "specialized_teacher") {
    throw new Error("Only teachers can view submission detail.");
  }
  if (teacher.subjectId !== assignment.subjectId || !teacherClassIds(teacher).includes(assignment.classId)) {
    throw new Error("Not authorized to view this submission.");
  }
  return { submission, assignment, student };
}

export async function approveUser(superAdmin: User, userId: string) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can approve users.");
  }
  userState = userState.map((user) =>
    user._id === userId ? { ...user, approved: true } : user,
  );
}

export async function assignRole(superAdmin: User, userId: string, role: User["role"]) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can assign roles.");
  }
  userState = userState.map((user) => (user._id === userId ? { ...user, role } : user));
}

export async function assignSubjectTeacher(
  superAdmin: User,
  subjectId: string,
  teacherId: string,
) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can assign subject owners.");
  }
  const teacher = userState.find((item) => item._id === teacherId);
  if (!teacher) {
    throw new Error("Teacher not found.");
  }
  userState = userState.map((candidate) =>
    candidate._id === teacherId ? { ...candidate, subjectId } : candidate,
  );
}
