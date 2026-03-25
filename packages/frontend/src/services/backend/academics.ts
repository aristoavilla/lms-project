import type {
  Assignment,
  AttendanceRecord,
  RankedStudent,
  Submission,
  SubmissionType,
  User,
} from "../../types";
import { getJson, mapAssignment, mapAttendance, mapSubmission, mapUser, postJson, type ApiUser } from "./core";

export async function listAssignmentsForUser(_user: User) {
  const payload = await getJson<{ assignments: Assignment[] }>("/lms/users/me/assignments");
  return payload.assignments.map(mapAssignment);
}

export async function createAssignment(
  _teacher: User,
  input: Pick<
    Assignment,
    "title" | "description" | "subjectId" | "classId" | "deadline" | "totalScore"
  >,
) {
  const payload = await postJson<{ assignment: Assignment }>("/lms/assignments", input);
  return mapAssignment(payload.assignment);
}

export async function submitAssignment(
  _user: User,
  assignmentId: string,
  payload: string,
  submissionType: SubmissionType,
) {
  const response = await postJson<{ submission: Submission }>(
    `/lms/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    { payload, submissionType },
  );
  return mapSubmission(response.submission);
}

export async function gradeSubmission(
  _teacher: User,
  submissionId: string,
  score: number,
  comment?: string,
) {
  const payload = await postJson<{ submission: Submission }>(
    `/lms/submissions/${encodeURIComponent(submissionId)}/grade`,
    { score, comment },
  );
  return mapSubmission(payload.submission);
}

export async function listAttendance(_user: User) {
  const payload = await getJson<{ attendance: AttendanceRecord[] }>("/lms/users/me/attendance");
  return payload.attendance.map(mapAttendance);
}

export async function markAttendance(
  _teacher: User,
  input: {
    subjectId: string;
    classId: string;
    studentId: string;
    date: string;
    status: AttendanceRecord["status"];
  },
) {
  const payload = await postJson<{ attendance: AttendanceRecord | null }>("/lms/attendance", input);
  return payload.attendance;
}

export async function getSubjectRanking(_user: User, subjectId: string, classId: string) {
  const payload = await getJson<{ ranking: RankedStudent[] }>(
    `/lms/rankings/subject?subjectId=${encodeURIComponent(subjectId)}&classId=${encodeURIComponent(classId)}`,
  );
  return payload.ranking;
}

export async function getOverallRanking(_user: User, classId?: string) {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  const payload = await getJson<{ ranking: RankedStudent[] }>(`/lms/rankings/overall${query}`);
  return payload.ranking;
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  const payload = await getJson<{ submissions: Submission[] }>(
    `/lms/assignments/${encodeURIComponent(assignmentId)}/submissions`,
  );
  return payload.submissions.map(mapSubmission);
}

export async function listMyVisibleSubmissions(assignmentIds: string[]) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.filter((id) => id.trim().length > 0)));
  if (uniqueAssignmentIds.length === 0) {
    return [] as Submission[];
  }
  const query = encodeURIComponent(uniqueAssignmentIds.join(","));
  const payload = await getJson<{ submissions: Submission[] }>(
    `/lms/users/me/submissions?assignmentIds=${query}`,
  );
  return payload.submissions.map(mapSubmission);
}

export async function getSubmissionDetail(_teacher: User, submissionId: string) {
  const payload = await getJson<{ submission: Submission; assignment: Assignment; student: ApiUser | null }>(
    `/lms/submissions/${encodeURIComponent(submissionId)}`,
  );
  if (!payload.student) {
    throw new Error("Student not found.");
  }
  return {
    submission: mapSubmission(payload.submission),
    assignment: mapAssignment(payload.assignment),
    student: mapUser(payload.student),
  };
}