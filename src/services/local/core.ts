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
} from "../../data/seed";
import type {
  Chat,
  FileAsset,
  Message,
  TeacherClassSubject,
  User,
} from "../../types";

export { classes, semesters, subjects, teacherClassSubjects };

const SESSION_USER_KEY = "lms:session:userId";
const DEFAULT_SEEDED_PASSWORD = "Password123!";
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export const localStore = {
  announcementState: [...announcements],
  submissionState: [...submissions],
  attendanceState: [...attendance],
  userState: [...users],
  assignmentState: [...assignments],
  chatState: [] as Chat[],
  messageState: [] as Message[],
  readCursorState: new Map<string, Map<string, string>>(),
  passwordState: new Map<string, string>(),
  loginAttemptState: new Map<
    string,
    { failures: number; firstFailureAt: number; blockedUntil: number }
  >(),
  authInitialized: false,
};

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

localStore.chatState = buildBaseChats();
localStore.messageState = buildSeedMessages();

export function getDefaultSeededPassword() {
  return DEFAULT_SEEDED_PASSWORD;
}

export function delay(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ensureAuthStateInitialized() {
  if (localStore.authInitialized) {
    return;
  }
  for (const user of localStore.userState) {
    const key = normalizeEmail(user.email);
    if (!localStore.passwordState.has(key)) {
      localStore.passwordState.set(key, DEFAULT_SEEDED_PASSWORD);
    }
  }
  localStore.authInitialized = true;
}

export function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return localStore.userState.find(
    (candidate) => normalizeEmail(candidate.email) === normalized,
  );
}

export function setSessionUser(userId: string | null) {
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
  const current = localStore.loginAttemptState.get(key);
  if (current) {
    return current;
  }
  const created = { failures: 0, firstFailureAt: 0, blockedUntil: 0 };
  localStore.loginAttemptState.set(key, created);
  return created;
}

export function registerFailedAttempt(email: string) {
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

export function ensureNotRateLimited(email: string) {
  const now = Date.now();
  const state = getAttemptState(email);
  if (state.blockedUntil > now) {
    throw new Error("Too many failed login attempts. Try again later.");
  }
}

export function clearAttemptState(email: string) {
  localStore.loginAttemptState.delete(normalizeEmail(email));
}

export function nextUserId(role: User["role"]) {
  const suffix = Math.random().toString(16).slice(2, 8);
  const shortRole =
    role === "regular_student"
      ? "student"
      : role === "administrative_student"
        ? "admin-student"
        : role.replace("_", "-");
  return `u-${shortRole}-${Date.now()}-${suffix}`;
}

export function isStudent(user: User) {
  return user.role === "regular_student" || user.role === "administrative_student";
}

function teacherMappings(user: User) {
  if (user.role !== "main_teacher" && user.role !== "specialized_teacher") {
    return [] as TeacherClassSubject[];
  }
  return teacherClassSubjects.filter((mapping) => mapping.teacherId === user._id);
}

export function teacherClassIds(user: User) {
  const mappingIds = teacherMappings(user).map((mapping) => mapping.classId);
  if (mappingIds.length > 0) {
    return Array.from(new Set(mappingIds));
  }
  return user.taughtClassIds ?? [];
}

export function teacherOwnSubjectId(user: User) {
  return user.subjectId ?? null;
}

export function studentsByClass(classId: string) {
  return localStore.userState.filter(
    (candidate) => candidate.classId === classId && isStudent(candidate),
  );
}

export function approvedUsersByClass(classId: string) {
  return localStore.userState.filter(
    (candidate) => candidate.classId === classId && candidate.approved,
  );
}

export function sanitizeContent(raw: string) {
  return raw.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

export function assertApproved(user: User) {
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

export function canAccessClass(user: User, classId: string) {
  if (user.role === "super_admin") {
    return true;
  }
  return classScopeForUser(user).includes(classId);
}

export function canSendInChat(user: User) {
  return user.role !== "super_admin";
}

export function classChatId(classId: string) {
  return `chat-class-${classId}`;
}

export function subjectChatId(classId: string, subjectId: string) {
  return `chat-subject-${classId}-${subjectId}`;
}

export function directChatId(classId: string, a: string, b: string) {
  const sorted = [a, b].sort();
  return `chat-direct-${classId}-${sorted[0]}-${sorted[1]}`;
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
    localStore.userState.some(
      (candidate) => candidate._id === userId && candidate.approved,
    ),
  );
}

export function assertChatMembership(user: User, chat: Chat) {
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

export function assertAttachment(input?: FileAsset) {
  if (!input) {
    return;
  }
  if (!input.name || !input.mimeType || !input.url) {
    throw new Error("Attachment payload is invalid.");
  }
}

export function ensureReadMap(userId: string) {
  const existing = localStore.readCursorState.get(userId);
  if (existing) {
    return existing;
  }
  const created = new Map<string, string>();
  localStore.readCursorState.set(userId, created);
  return created;
}

export function unreadCountForChat(user: User, chat: Chat) {
  if (user.role === "super_admin") {
    return 0;
  }
  const userReadMap = ensureReadMap(user._id);
  const lastRead = userReadMap.get(chat._id);
  return localStore.messageState.filter(
    (message) =>
      message.chatId === chat._id &&
      message.senderId !== user._id &&
      (!lastRead || +new Date(message.createdAt) > +new Date(lastRead)),
  ).length;
}

export function titleForChat(chat: Chat) {
  if (chat.type === "class") {
    return `${chat.classId.replace("class-", "Class ")} Group`;
  }
  if (chat.type === "subject") {
    const subjectName = subjects.find((row) => row._id === chat.subjectId)?.name ?? "Subject";
    return `${subjectName} (${chat.classId.replace("class-", "Class ")})`;
  }
  const directIds = chat.participantIds ?? [];
  const names = directIds
    .map(
      (userId) =>
        localStore.userState.find((candidate) => candidate._id === userId)?.name ?? userId,
    )
    .join(" + ");
  return names || "Direct Message";
}

export function getChatOrThrow(chatId: string) {
  const chat = localStore.chatState.find((row) => row._id === chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }
  return chat;
}

export function validateProfileImage(file?: FileAsset | File | null) {
  if (!file) {
    return;
  }
  const mimeType = "mimeType" in file ? file.mimeType : file.type;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(mimeType)) {
    throw new Error("Only jpg, png, and webp images are supported.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Profile image max size is 2MB.");
  }
}

export function getSessionUserFromStorage() {
  if (!canUseLocalStorage()) {
    return undefined;
  }
  const userId = window.localStorage.getItem(SESSION_USER_KEY);
  if (!userId) {
    return undefined;
  }
  return localStore.userState.find((candidate) => candidate._id === userId);
}
