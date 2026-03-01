import {
  announcements,
  assignments,
  attendance,
  semesters,
  subjects,
  submissions,
  users,
} from "../data/seed";
import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  RankedStudent,
  Submission,
  User,
} from "../types";
import { canManageAnnouncements, canViewOverallRanking, canViewRanking } from "../utils/rbac";
import { calculateOverallRanking, calculateSubjectRanking } from "../utils/ranking";

let announcementState = [...announcements];
let submissionState = [...submissions];
let attendanceState = [...attendance];
let userState = [...users];

function delay(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function currentUserQuery(userId: string) {
  return userState.find((user) => user._id === userId);
}

export function getAllUsers() {
  return userState;
}

export async function listSubjectsByClass(classId: string) {
  await delay();
  return subjects.filter((subject) => subject.classId === classId);
}

export async function listAssignmentsForUser(user: User) {
  await delay();
  const classSubjects = subjects
    .filter((subject) => subject.classId === user.classId)
    .map((subject) => subject._id);
  if (user.role === "specialized_teacher") {
    return assignments.filter((assignment) =>
      user.subjectIds?.includes(assignment.subjectId),
    );
  }
  return assignments.filter((assignment) => classSubjects.includes(assignment.subjectId));
}

export async function createAssignment(
  teacher: User,
  input: Pick<
    Assignment,
    "title" | "description" | "subjectId" | "deadline" | "totalScore"
  >,
) {
  await delay();
  if (teacher.role !== "main_teacher") {
    throw new Error("Only main teachers can create assignments.");
  }
  const subject = subjects.find((item) => item._id === input.subjectId);
  if (!subject) {
    throw new Error("Subject not found.");
  }
  if (subject.teacherId !== teacher._id) {
    throw new Error("You can only create assignments for your owned subject.");
  }
  assignments.unshift({
    _id: `as-${Date.now()}`,
    subjectId: input.subjectId,
    semesterId: semesters[0]._id,
    title: input.title,
    description: input.description,
    deadline: input.deadline,
    allowLate: true,
    allowResubmit: true,
    totalScore: input.totalScore,
    createdBy: teacher._id,
    assignmentType: "text",
  });
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
  if (user.role !== "regular_student" && user.role !== "administrative_student") {
    throw new Error("Only students can submit assignments.");
  }

  const assignment = assignments.find((item) => item._id === assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  const subject = subjects.find((item) => item._id === assignment.subjectId);
  if (!subject || subject.classId !== user.classId) {
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
  const assignment = assignments.find((item) => item._id === submission.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }
  const subject = subjects.find((item) => item._id === assignment.subjectId);
  if (!subject) {
    throw new Error("Subject not found.");
  }
  const canGrade =
    (teacher.role === "main_teacher" || teacher.role === "specialized_teacher") &&
    subject.teacherId === teacher._id;
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
  if (user.role === "regular_student" || user.role === "administrative_student") {
    return attendanceState.filter((record) => record.studentId === user._id);
  }
  if (user.role === "specialized_teacher") {
    const subjectIds = user.subjectIds ?? [];
    return attendanceState.filter((record) => subjectIds.includes(record.subjectId));
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
  const subject = subjects.find((item) => item._id === input.subjectId);
  if (!subject) {
    throw new Error("Subject not found.");
  }
  if (teacher.role === "specialized_teacher" && subject.teacherId !== teacher._id) {
    throw new Error("Specialized teachers can only mark their own subject.");
  }
  attendanceState = [
    ...attendanceState.filter(
      (row) =>
        !(
          row.subjectId === input.subjectId &&
          row.studentId === input.studentId &&
          row.date === input.date
        ),
    ),
    {
      ...input,
      _id: `att-${Date.now()}`,
      semesterId: semesters[0]._id,
    },
  ];
}

export async function getSubjectRanking(user: User, subjectId: string): Promise<RankedStudent[]> {
  await delay();
  if (!canViewRanking(user)) {
    throw new Error("Ranking is blocked for students.");
  }
  if (user.role === "specialized_teacher" && !(user.subjectIds ?? []).includes(subjectId)) {
    throw new Error("Specialized teacher can only view their subject ranking.");
  }
  const classStudents = userState.filter(
    (candidate) =>
      candidate.classId === user.classId &&
      (candidate.role === "regular_student" || candidate.role === "administrative_student"),
  );
  return calculateSubjectRanking(subjectId, assignments, submissionState, classStudents);
}

export async function getOverallRanking(user: User) {
  await delay();
  if (!canViewOverallRanking(user)) {
    throw new Error("Only Main Teacher can access overall ranking.");
  }
  const classStudents = userState.filter(
    (candidate) =>
      candidate.classId === user.classId &&
      (candidate.role === "regular_student" || candidate.role === "administrative_student"),
  );
  return calculateOverallRanking(assignments, submissionState, classStudents);
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  await delay();
  return submissionState.filter((submission) => submission.assignmentId === assignmentId);
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
  const subject = subjects.find((item) => item._id === subjectId);
  const teacher = userState.find((item) => item._id === teacherId);
  if (!subject || !teacher) {
    throw new Error("Subject or teacher not found.");
  }
  subject.teacherId = teacherId;
}
