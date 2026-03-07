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
  Chat,
  ChatThread,
  FileAsset,
  Message,
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
let chatState = buildBaseChats();
let messageState = buildSeedMessages();
const readCursorState = new Map<string, Map<string, string>>();
const passwordState = new Map<string, string>();
const loginAttemptState = new Map<
  string,
  { failures: number; firstFailureAt: number; blockedUntil: number }
>();
const SESSION_USER_KEY = "lms:session:userId";
const DEFAULT_SEEDED_PASSWORD = "Password123!";
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
let authInitialized = false;

function delay(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensureAuthStateInitialized() {
  if (authInitialized) {
    return;
  }
  for (const user of userState) {
    const key = normalizeEmail(user.email);
    if (!passwordState.has(key)) {
      passwordState.set(key, DEFAULT_SEEDED_PASSWORD);
    }
  }
  authInitialized = true;
}

function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return userState.find((candidate) => normalizeEmail(candidate.email) === normalized);
}

function setSessionUser(userId: string | null) {
  if (!canUseLocalStorage()) {
    return;
  }
  if (!userId) {
    window.localStorage.removeItem(SESSION_USER_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_USER_KEY, userId);
}

function getAttemptState(email: string) {
  const key = normalizeEmail(email);
  const current = loginAttemptState.get(key);
  if (current) {
    return current;
  }
  const created = { failures: 0, firstFailureAt: 0, blockedUntil: 0 };
  loginAttemptState.set(key, created);
  return created;
}

function registerFailedAttempt(email: string) {
  const now = Date.now();
  const state = getAttemptState(email);
  if (state.firstFailureAt === 0 || now - state.firstFailureAt > LOGIN_WINDOW_MS) {
    state.failures = 0;
    state.firstFailureAt = now;
  }
  state.failures += 1;
  if (state.failures >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = now + LOGIN_BLOCK_MS;
  }
}

function ensureNotRateLimited(email: string) {
  const now = Date.now();
  const state = getAttemptState(email);
  if (state.blockedUntil > now) {
    throw new Error("Too many failed login attempts. Try again later.");
  }
}

function clearAttemptState(email: string) {
  loginAttemptState.delete(normalizeEmail(email));
}

function nextUserId(role: User["role"]) {
  const suffix = Math.random().toString(16).slice(2, 8);
  const shortRole =
    role === "regular_student"
      ? "student"
      : role === "administrative_student"
        ? "admin-student"
        : role.replace("_", "-");
  return `u-${shortRole}-${Date.now()}-${suffix}`;
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

function approvedUsersByClass(classId: string) {
  return userState.filter((candidate) => candidate.classId === classId && candidate.approved);
}

function sanitizeContent(raw: string) {
  return raw.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

function assertApproved(user: User) {
  if (!user.approved) {
    throw new Error("Only approved users can access chat and profile features.");
  }
}

function isTeacher(user: User) {
  return user.role === "main_teacher" || user.role === "specialized_teacher";
}

function classScopeForUser(user: User) {
  if (user.role === "super_admin") {
    return classes.map((row) => row._id);
  }
  if (isTeacher(user)) {
    return Array.from(new Set([user.classId, ...teacherClassIds(user)]));
  }
  return [user.classId];
}

function canAccessClass(user: User, classId: string) {
  if (user.role === "super_admin") {
    return true;
  }
  return classScopeForUser(user).includes(classId);
}

function canSendInChat(user: User) {
  return user.role !== "super_admin";
}

function classChatId(classId: string) {
  return `chat-class-${classId}`;
}

function subjectChatId(classId: string, subjectId: string) {
  return `chat-subject-${classId}-${subjectId}`;
}

function directChatId(classId: string, a: string, b: string) {
  const sorted = [a, b].sort();
  return `chat-direct-${classId}-${sorted[0]}-${sorted[1]}`;
}

function buildBaseChats(): Chat[] {
  const classChats: Chat[] = classes.map((room) => ({
    _id: classChatId(room._id),
    type: "class",
    classId: room._id,
    createdAt: new Date().toISOString(),
  }));

  const seen = new Set<string>();
  const subjectChats: Chat[] = teacherClassSubjects
    .filter((mapping) => {
      const key = `${mapping.classId}-${mapping.subjectId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((mapping) => ({
      _id: subjectChatId(mapping.classId, mapping.subjectId),
      type: "subject",
      classId: mapping.classId,
      subjectId: mapping.subjectId,
      createdAt: new Date().toISOString(),
    }));

  return [...classChats, ...subjectChats];
}

function buildSeedMessages(): Message[] {
  return classes.flatMap((room, index) => {
    const classUsers = approvedUsersByClass(room._id);
    const sender = classUsers[0];
    if (!sender) {
      return [];
    }
    return [
      {
        _id: `msg-${room._id}-welcome`,
        chatId: classChatId(room._id),
        senderId: sender._id,
        content: `Welcome to ${room.name} chat. Keep discussion focused and respectful.`,
        createdAt: new Date(Date.now() - (index + 1) * 60000).toISOString(),
        deleted: false,
      },
    ];
  });
}

function listChatMembers(chat: Chat) {
  if (chat.type === "direct") {
    return chat.participantIds ?? [];
  }
  if (chat.type === "class") {
    return approvedUsersByClass(chat.classId).map((user) => user._id);
  }
  const assignedTeacherIds = teacherClassSubjects
    .filter(
      (mapping) => mapping.classId === chat.classId && mapping.subjectId === chat.subjectId,
    )
    .map((mapping) => mapping.teacherId);
  const studentIds = studentsByClass(chat.classId).map((student) => student._id);
  const pool = new Set([...assignedTeacherIds, ...studentIds]);
  return Array.from(pool).filter((userId) =>
    userState.some((candidate) => candidate._id === userId && candidate.approved),
  );
}

function assertChatMembership(user: User, chat: Chat) {
  if (user.role === "super_admin") {
    return;
  }
  if (!canAccessClass(user, chat.classId)) {
    throw new Error("Cannot access chat outside your allowed class scope.");
  }
  if (!listChatMembers(chat).includes(user._id)) {
    throw new Error("User is not a member of this chat.");
  }
}

function assertAttachment(input?: FileAsset) {
  if (!input) {
    return;
  }
  if (!input.name || !input.mimeType || !input.url) {
    throw new Error("Attachment payload is invalid.");
  }
}

function ensureReadMap(userId: string) {
  const existing = readCursorState.get(userId);
  if (existing) {
    return existing;
  }
  const created = new Map<string, string>();
  readCursorState.set(userId, created);
  return created;
}

function unreadCountForChat(user: User, chat: Chat) {
  if (user.role === "super_admin") {
    return 0;
  }
  const userReadMap = ensureReadMap(user._id);
  const lastRead = userReadMap.get(chat._id);
  return messageState.filter(
    (message) =>
      message.chatId === chat._id &&
      message.senderId !== user._id &&
      (!lastRead || +new Date(message.createdAt) > +new Date(lastRead)),
  ).length;
}

function titleForChat(chat: Chat) {
  if (chat.type === "class") {
    return `${chat.classId.replace("class-", "Class ")} Group`;
  }
  if (chat.type === "subject") {
    const subjectName = subjects.find((row) => row._id === chat.subjectId)?.name ?? "Subject";
    return `${subjectName} (${chat.classId.replace("class-", "Class ")})`;
  }
  const directIds = chat.participantIds ?? [];
  const names = directIds
    .map((userId) => userState.find((candidate) => candidate._id === userId)?.name ?? userId)
    .join(" + ");
  return names || "Direct Message";
}

function getChatOrThrow(chatId: string) {
  const chat = chatState.find((row) => row._id === chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }
  return chat;
}

function validateProfileImage(file?: FileAsset | null) {
  if (!file) {
    return;
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimeType)) {
    throw new Error("Only jpg, png, and webp images are supported.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Profile image max size is 2MB.");
  }
}

export function getDefaultSeededPassword() {
  return DEFAULT_SEEDED_PASSWORD;
}

export function getSessionUser() {
  if (!canUseLocalStorage()) {
    return undefined;
  }
  const userId = window.localStorage.getItem(SESSION_USER_KEY);
  if (!userId) {
    return undefined;
  }
  return userState.find((candidate) => candidate._id === userId);
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password?: string;
  provider: "email" | "oauth";
  classId?: string;
}) {
  await delay(180);
  ensureAuthStateInitialized();

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const classId = input.classId ?? "class-1A";
  const password = input.password?.trim();

  if (!name) {
    throw new Error("Full name is required.");
  }
  if (!email) {
    throw new Error("Email is required.");
  }
  if (!classes.some((row) => row._id === classId)) {
    throw new Error("Class is invalid.");
  }
  if (findUserByEmail(email)) {
    throw new Error("Email already registered.");
  }
  if (input.provider === "email" && !password) {
    throw new Error("Password is required for email registration.");
  }

  const created: User = {
    _id: nextUserId("regular_student"),
    name,
    email,
    role: "regular_student",
    approved: false,
    classId,
    bio: "",
    createdAt: new Date().toISOString(),
  };

  userState = [created, ...userState];
  if (input.provider === "email" && password) {
    passwordState.set(email, password);
  }
  return created;
}

export async function loginWithEmail(emailInput: string, passwordInput: string) {
  await delay(140);
  ensureAuthStateInitialized();

  const email = normalizeEmail(emailInput);
  const password = passwordInput.trim();
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  ensureNotRateLimited(email);
  const user = findUserByEmail(email);
  const storedPassword = passwordState.get(email);

  if (!user || !storedPassword || storedPassword !== password) {
    registerFailedAttempt(email);
    throw new Error("Invalid email or password.");
  }

  clearAttemptState(email);
  setSessionUser(user._id);
  return user;
}

export async function loginWithOAuth(emailInput: string) {
  await delay(120);
  ensureAuthStateInitialized();

  const email = normalizeEmail(emailInput);
  if (!email) {
    throw new Error("Email is required.");
  }

  const existing = findUserByEmail(email);
  if (!existing) {
    throw new Error("No account found for this OAuth email.");
  }

  setSessionUser(existing._id);
  return existing;
}

export async function logout(activeUserId?: string) {
  await delay(50);
  if (activeUserId) {
    const user = userState.find((candidate) => candidate._id === activeUserId);
    if (user) {
      clearAttemptState(user.email);
    }
  }
  setSessionUser(null);
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

export async function listAnnouncementsForUser(user: User) {
  await delay();
  if (user.role === "super_admin") {
    return [...announcementState].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }
  return announcementState
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

export async function listVisibleProfiles(user: User) {
  await delay();
  assertApproved(user);
  if (user.role === "super_admin") {
    return userState;
  }
  return userState.filter((candidate) => candidate.classId === user.classId && candidate.approved);
}

export async function updateOwnProfile(
  user: User,
  patch: { name: string; bio: string; profileImage?: FileAsset | null },
) {
  await delay(220);
  assertApproved(user);
  const nextName = patch.name.trim();
  if (!nextName) {
    throw new Error("Full name is required.");
  }
  validateProfileImage(patch.profileImage ?? undefined);
  userState = userState.map((candidate) => {
    if (candidate._id !== user._id) {
      return candidate;
    }
    return {
      ...candidate,
      name: nextName,
      bio: patch.bio.trim(),
      profileImageId: patch.profileImage ? patch.profileImage.id : undefined,
      profileImageUrl: patch.profileImage ? patch.profileImage.url : undefined,
    };
  });
  return userState.find((candidate) => candidate._id === user._id);
}

export async function listChatThreadsForUser(user: User): Promise<ChatThread[]> {
  await delay(120);
  assertApproved(user);

  const visibleChats = chatState.filter((chat) => {
    if (user.role === "super_admin") {
      return true;
    }
    if (!canAccessClass(user, chat.classId)) {
      return false;
    }
    return listChatMembers(chat).includes(user._id);
  });

  return visibleChats
    .map((chat) => {
      const latest = messageState
        .filter((message) => message.chatId === chat._id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      return {
        chat,
        title: titleForChat(chat),
        unreadCount: unreadCountForChat(user, chat),
        lastMessageAt: latest?.createdAt ?? null,
      };
    })
    .sort((a, b) => {
      const left = a.lastMessageAt ? +new Date(a.lastMessageAt) : +new Date(a.chat.createdAt);
      const right = b.lastMessageAt ? +new Date(b.lastMessageAt) : +new Date(b.chat.createdAt);
      return right - left;
    });
}

export async function listMessagesForChat(user: User, chatId: string) {
  await delay(130);
  assertApproved(user);
  const chat = getChatOrThrow(chatId);
  assertChatMembership(user, chat);
  return messageState
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

export async function markChatAsRead(user: User, chatId: string) {
  await delay(10);
  assertApproved(user);
  const chat = getChatOrThrow(chatId);
  assertChatMembership(user, chat);
  const latest = messageState
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  if (!latest) {
    return;
  }
  const map = ensureReadMap(user._id);
  map.set(chatId, latest.createdAt);
}

export async function sendMessage(
  user: User,
  input: {
    chatId?: string;
    type: Chat["type"];
    classId: string;
    subjectId?: string;
    recipientUserId?: string;
    content: string;
    attachment?: FileAsset;
  },
) {
  await delay(110);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  if (!canAccessClass(user, input.classId)) {
    throw new Error("Cannot send message outside your allowed class scope.");
  }

  assertAttachment(input.attachment);
  const content = sanitizeContent(input.content);
  if (!content && !input.attachment) {
    throw new Error("Message content or attachment is required.");
  }

  let targetChat: Chat;
  if (input.type === "direct") {
    if (!input.recipientUserId) {
      throw new Error("Direct message requires a recipient.");
    }
    const recipient = userState.find((candidate) => candidate._id === input.recipientUserId);
    if (!recipient || !recipient.approved) {
      throw new Error("Recipient is not available.");
    }
    if (recipient._id === user._id) {
      throw new Error("Cannot send direct message to yourself.");
    }
    if (user.classId !== recipient.classId || input.classId !== user.classId) {
      throw new Error("Cross-class messaging is forbidden.");
    }
    const newChatId = directChatId(input.classId, user._id, recipient._id);
    const existing = chatState.find((chat) => chat._id === newChatId);
    targetChat =
      existing ??
      {
        _id: newChatId,
        type: "direct",
        classId: input.classId,
        participantIds: [user._id, recipient._id].sort(),
        createdAt: new Date().toISOString(),
      };
    if (!existing) {
      chatState = [targetChat, ...chatState];
    }
  } else if (input.chatId) {
    targetChat = getChatOrThrow(input.chatId);
  } else if (input.type === "class") {
    targetChat = getChatOrThrow(classChatId(input.classId));
  } else {
    if (!input.subjectId) {
      throw new Error("Subject chat requires subjectId.");
    }
    targetChat = getChatOrThrow(subjectChatId(input.classId, input.subjectId));
  }

  assertChatMembership(user, targetChat);

  const created: Message = {
    _id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    chatId: targetChat._id,
    senderId: user._id,
    content: content || "Attachment",
    attachment: input.attachment,
    createdAt: new Date().toISOString(),
    deleted: false,
  };
  messageState = [...messageState, created];
  const map = ensureReadMap(user._id);
  map.set(targetChat._id, created.createdAt);
  return created;
}

export async function editMessage(user: User, messageId: string, content: string) {
  await delay(100);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  const existing = messageState.find((row) => row._id === messageId);
  if (!existing) {
    throw new Error("Message not found.");
  }
  if (existing.senderId !== user._id) {
    throw new Error("Cannot edit other users' messages.");
  }
  const minutes = (+new Date() - +new Date(existing.createdAt)) / 60000;
  if (minutes > 10) {
    throw new Error("Message can only be edited within 10 minutes.");
  }
  if (existing.deleted) {
    throw new Error("Deleted message cannot be edited.");
  }
  const nextContent = sanitizeContent(content);
  if (!nextContent) {
    throw new Error("Message content cannot be empty.");
  }
  messageState = messageState.map((row) =>
    row._id === messageId
      ? {
          ...row,
          content: nextContent,
          editedAt: new Date().toISOString(),
        }
      : row,
  );
}

export async function softDeleteMessage(user: User, messageId: string) {
  await delay(90);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  const existing = messageState.find((row) => row._id === messageId);
  if (!existing) {
    throw new Error("Message not found.");
  }
  if (existing.senderId !== user._id) {
    throw new Error("Cannot delete other users' messages.");
  }
  messageState = messageState.map((row) =>
    row._id === messageId
      ? {
          ...row,
          content: "Message deleted",
          attachment: undefined,
          deleted: true,
        }
      : row,
  );
}

export async function listDirectContacts(user: User) {
  await delay(60);
  assertApproved(user);
  if (user.role === "super_admin") {
    return [];
  }
  return userState.filter(
    (candidate) =>
      candidate._id !== user._id &&
      candidate.approved &&
      candidate.classId === user.classId,
  );
}
