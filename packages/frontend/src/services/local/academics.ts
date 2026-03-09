import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  RankedStudent,
  Submission,
  User,
} from "../../types";
import { canManageAnnouncements, canViewOverallRanking, canViewRanking } from "../../utils/rbac";
import { calculateOverallRanking, calculateSubjectRanking } from "../../utils/ranking";
import {
  classes,
  delay,
  isStudent,
  localStore,
  semesters,
  studentsByClass,
  subjects,
  teacherClassIds,
  teacherClassSubjects,
  teacherOwnSubjectId,
} from "./core";

export function currentUserQuery(userId: string) {
  return localStore.userState.find((user) => user._id === userId);
}

export function getAllUsers() {
  return localStore.userState;
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
    return localStore.assignmentState;
  }
  if (isStudent(user)) {
    return localStore.assignmentState.filter((assignment) => assignment.classId === user.classId);
  }
  const classIds = teacherClassIds(user);
  const subjectId = teacherOwnSubjectId(user);
  return localStore.assignmentState.filter(
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
  localStore.assignmentState = [
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
    ...localStore.assignmentState,
  ];
}

export async function listAnnouncementsForClass(classId: string) {
  await delay();
  return localStore.announcementState
    .filter((announcement) => announcement.classId === classId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function listAnnouncementsForUser(user: User) {
  await delay();
  if (user.role === "super_admin") {
    return [...localStore.announcementState].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }
  return localStore.announcementState
    .filter((announcement) => announcement.classId === user.classId)
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
  localStore.announcementState = [created, ...localStore.announcementState];
  return created;
}

export async function updateAnnouncement(
  user: User,
  announcementId: string,
  patch: Pick<Announcement, "title" | "content">,
) {
  await delay();
  const current = localStore.announcementState.find((item) => item._id === announcementId);
  if (!current) {
    throw new Error("Announcement not found.");
  }
  if (current.createdBy !== user._id) {
    throw new Error("You can edit only your own announcements.");
  }
  localStore.announcementState = localStore.announcementState.map((item) =>
    item._id === announcementId ? { ...item, ...patch } : item,
  );
}

export async function deleteAnnouncement(user: User, announcementId: string) {
  await delay();
  const current = localStore.announcementState.find((item) => item._id === announcementId);
  if (!current) {
    throw new Error("Announcement not found.");
  }
  if (current.createdBy !== user._id) {
    throw new Error("You can delete only your own announcements.");
  }
  localStore.announcementState = localStore.announcementState.filter(
    (item) => item._id !== announcementId,
  );
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

  const assignment = localStore.assignmentState.find((item) => item._id === assignmentId);
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

  const existing = localStore.submissionState.find(
    (item) => item.assignmentId === assignmentId && item.studentId === user._id,
  );
  if (existing && !assignment.allowResubmit) {
    throw new Error("Resubmission is not allowed for this assignment.");
  }

  if (existing) {
    localStore.submissionState = localStore.submissionState.map((item) =>
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

  localStore.submissionState = [
    ...localStore.submissionState,
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
  const submission = localStore.submissionState.find((item) => item._id === submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }
  const assignment = localStore.assignmentState.find(
    (item) => item._id === submission.assignmentId,
  );
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
  localStore.submissionState = localStore.submissionState.map((item) =>
    item._id === submissionId ? { ...item, score, comment } : item,
  );
}

export async function listAttendance(user: User) {
  await delay();
  if (isStudent(user)) {
    return localStore.attendanceState.filter((record) => record.studentId === user._id);
  }
  if (user.role === "specialized_teacher") {
    const classIds = teacherClassIds(user);
    return localStore.attendanceState.filter(
      (record) =>
        classIds.includes(record.classId) &&
        (user.subjectId ? record.subjectId === user.subjectId : true),
    );
  }
  if (user.role === "main_teacher") {
    const classIds = teacherClassIds(user);
    return localStore.attendanceState.filter(
      (record) =>
        record.classId === user.classId ||
        (classIds.includes(record.classId) &&
          (user.subjectId ? record.subjectId === user.subjectId : true)),
    );
  }
  return localStore.attendanceState;
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
  const student = localStore.userState.find((candidate) => candidate._id === input.studentId);
  if (!student || student.classId !== input.classId || !isStudent(student)) {
    throw new Error("Student not found in selected class.");
  }
  localStore.attendanceState = [
    ...localStore.attendanceState.filter(
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
  const classAssignments = localStore.assignmentState.filter(
    (assignment) => assignment.classId === classId && assignment.subjectId === subjectId,
  );
  return calculateSubjectRanking(
    subjectId,
    classAssignments,
    localStore.submissionState,
    classStudents,
  );
}

export async function getOverallRanking(user: User, classId?: string) {
  await delay();
  if (!canViewOverallRanking(user)) {
    throw new Error("Only Main Teacher can access overall ranking.");
  }
  const effectiveClassId =
    user.role === "main_teacher" ? user.classId : classId ?? classes[0]?._id ?? user.classId;
  const classStudents = studentsByClass(effectiveClassId);
  const classAssignments = localStore.assignmentState.filter(
    (assignment) => assignment.classId === effectiveClassId,
  );
  return calculateOverallRanking(
    classAssignments,
    localStore.submissionState,
    classStudents,
  );
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  await delay();
  return localStore.submissionState.filter(
    (submission) => submission.assignmentId === assignmentId,
  );
}

export async function getSubmissionDetail(teacher: User, submissionId: string) {
  await delay();
  const submission = localStore.submissionState.find((item) => item._id === submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }
  const assignment = localStore.assignmentState.find(
    (item) => item._id === submission.assignmentId,
  );
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  const student = localStore.userState.find((item) => item._id === submission.studentId);
  if (!student) {
    throw new Error("Student not found.");
  }
  if (teacher.role !== "main_teacher" && teacher.role !== "specialized_teacher") {
    throw new Error("Only teachers can view submission detail.");
  }
  if (
    teacher.subjectId !== assignment.subjectId ||
    !teacherClassIds(teacher).includes(assignment.classId)
  ) {
    throw new Error("Not authorized to view this submission.");
  }
  return { submission, assignment, student };
}
