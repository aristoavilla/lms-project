export type Role =
  | "super_admin"
  | "main_teacher"
  | "specialized_teacher"
  | "administrative_student"
  | "regular_student";

export type SubjectName =
  | "Math"
  | "English"
  | "Chemistry"
  | "Physics"
  | "Biology"
  | "History";

export type SubmissionType = "file" | "text" | "quiz";
export type AttendanceStatus = "Present" | "Absent" | "Excused";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  classId: string;
  subjectIds?: string[];
}

export interface ClassRoom {
  _id: string;
  name: string;
  mainTeacherId: string;
}

export interface Semester {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Subject {
  _id: string;
  name: SubjectName;
  classId: string;
  teacherId: string;
}

export interface Assignment {
  _id: string;
  subjectId: string;
  semesterId: string;
  title: string;
  description: string;
  deadline: string;
  allowLate: boolean;
  allowResubmit: boolean;
  totalScore: number;
  createdBy: string;
  assignmentType: SubmissionType;
  attachments?: string[];
}

export interface Submission {
  _id: string;
  assignmentId: string;
  studentId: string;
  submissionType: SubmissionType;
  payload: string;
  score?: number;
  comment?: string;
  submittedAt: string;
  late: boolean;
}

export interface AttendanceRecord {
  _id: string;
  subjectId: string;
  semesterId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  createdBy: string;
  attachment?: string;
  scheduledAt?: string;
  createdAt: string;
  classId: string;
}

export interface RankedStudent {
  studentId: string;
  studentName: string;
  average: number;
  earliestSubmissionAt: string;
}
