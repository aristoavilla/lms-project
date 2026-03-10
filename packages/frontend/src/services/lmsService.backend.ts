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
  SubmissionType,
  User,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const SESSION_TOKEN_KEY = "lms:session:token";
const SESSION_USER_KEY = "lms:session:user";
export const SESSION_USER_UPDATED_EVENT = "lms:session-user-updated";
const DEFAULT_DEMO_PASSWORD = "Password123!";

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("Backend API base URL is not configured.");
  }
  return API_BASE_URL;
}

function getSessionToken() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

function saveSessionToken(token: string | null) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  if (!token) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

function saveSessionUser(user: User | null) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(SESSION_USER_KEY);
    window.dispatchEvent(new CustomEvent(SESSION_USER_UPDATED_EVENT));
    return;
  }
  window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(SESSION_USER_UPDATED_EVENT));
}

function clearSession() {
  saveSessionToken(null);
  saveSessionUser(null);
}

function parseStoredUser(raw: string | null): User | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return undefined;
  }
}

function getStoredSessionUser() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return undefined;
  }
  return parseStoredUser(window.localStorage.getItem(SESSION_USER_KEY));
}

export function hasSessionToken() {
  return Boolean(getSessionToken());
}

export function getDefaultSeededPassword() {
  return DEFAULT_DEMO_PASSWORD;
}

function getAuthHeaders() {
  const token = getSessionToken();
  if (!token) {
    throw new Error("Missing session token. Please login again.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function withAuthErrorHandling<T>(request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown API error.";
    const unauthorized = /401|403|token|unauthorized|expired/i.test(message);
    if (unauthorized) {
      clearSession();
      throw new Error("Your session expired or is invalid. Please login again.");
    }
    throw error;
  }
}

async function parseApiError(response: Response) {
  const fallback = `Request failed with status ${response.status}.`;
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function getJson<T>(path: string): Promise<T> {
  return await withAuthErrorHandling(
    (async () => {
      const baseUrl = requireApiBaseUrl();
      const response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      return (await response.json()) as T;
    })(),
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return await withAuthErrorHandling(
    (async () => {
      const baseUrl = requireApiBaseUrl();
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      if (response.status === 204) {
        return null as T;
      }
      return (await response.json()) as T;
    })(),
  );
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return await withAuthErrorHandling(
    (async () => {
      const baseUrl = requireApiBaseUrl();
      const response = await fetch(`${baseUrl}${path}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      if (response.status === 204) {
        return null as T;
      }
      return (await response.json()) as T;
    })(),
  );
}

async function deleteRequest(path: string): Promise<void> {
  await withAuthErrorHandling(
    (async () => {
      const baseUrl = requireApiBaseUrl();
      const response = await fetch(`${baseUrl}${path}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    })(),
  );
}

async function postPublicJson<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as T;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  approved: boolean;
  classId: string;
  subjectId?: string;
  taughtClassIds?: string[];
  bio?: string;
  profileImageUrl?: string;
  createdAt?: string;
}

function mapUser(user: ApiUser): User {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    approved: user.approved,
    classId: user.classId,
    subjectId: user.subjectId,
    taughtClassIds: user.taughtClassIds,
    bio: user.bio,
    profileImageUrl: user.profileImageUrl,
    createdAt: user.createdAt,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function buildProfileImageKey(userId: string, fileName: string) {
  const sanitized = fileName.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
  const extension = sanitized.includes(".") ? sanitized.split(".").pop() : undefined;
  const extensionSuffix = extension ? `.${extension}` : "";
  return `profile-${encodeURIComponent(userId)}-${Date.now()}${extensionSuffix}`;
}

async function uploadProfileImage(file: File, userId: string) {
  const key = buildProfileImageKey(userId, file.name);
  const payload = await postJson<{ ok: boolean; url: string }>("/storage/upload", {
    key,
    contentType: file.type || "application/octet-stream",
    dataBase64: await fileToBase64(file),
  });

  if (!payload.url) {
    throw new Error("Profile image upload did not return a file URL.");
  }

  return payload.url;
}

function mapAssignment(assignment: {
  _id: string;
  subjectId: string;
  classId: string;
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
}): Assignment {
  return assignment;
}

function mapSubmission(submission: {
  _id: string;
  assignmentId: string;
  studentId: string;
  submissionType: SubmissionType;
  payload: string;
  score?: number;
  comment?: string;
  submittedAt: string;
  late: boolean;
}): Submission {
  return submission;
}

function mapAttendance(record: {
  _id: string;
  subjectId: string;
  classId: string;
  semesterId: string;
  studentId: string;
  date: string;
  status: AttendanceRecord["status"];
}): AttendanceRecord {
  return record;
}

export function currentUserQuery(_userId: string) {
  return getStoredSessionUser();
}

export function getSessionUser() {
  return getStoredSessionUser();
}

export async function restoreSessionUser() {
  const cachedUser = getStoredSessionUser();
  if (cachedUser) {
    return cachedUser;
  }

  const token = getSessionToken();
  if (!token) {
    return undefined;
  }

  const baseUrl = requireApiBaseUrl();
  const response = await fetch(`${baseUrl}/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await parseApiError(response);
    clearSession();
    throw new Error(message);
  }

  const payload = (await response.json()) as { user: ApiUser };
  const user = mapUser(payload.user);
  saveSessionUser(user);
  return user;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password?: string;
  provider: "email" | "oauth";
  classId?: string;
}) {
  if (input.provider !== "email") {
    throw new Error("OAuth registration is not supported by this endpoint.");
  }
  const payload = await postPublicJson<{ user: ApiUser }>("/auth/register", {
    name: input.name,
    email: input.email,
    password: input.password,
    classId: input.classId,
  });
  return mapUser(payload.user);
}

export async function loginWithEmail(email: string, password: string) {
  const payload = await postPublicJson<{ token: string; user: ApiUser }>("/auth/login", {
    email,
    password,
  });
  const user = mapUser(payload.user);
  saveSessionToken(payload.token);
  saveSessionUser(user);
  return user;
}

export async function loginWithOAuth(email: string) {
  const payload = await postPublicJson<{ token: string; user: ApiUser }>("/auth/oauth", {
    email,
  });
  const user = mapUser(payload.user);
  saveSessionToken(payload.token);
  saveSessionUser(user);
  return user;
}

export async function logout() {
  clearSession();
}

export async function getAllUsers() {
  const payload = await getJson<{ users: ApiUser[] }>("/lms/users");
  return payload.users.map(mapUser);
}

export async function getAllClasses() {
  const payload = await getJson<{ classes: Array<{ _id: string; name: string; mainTeacherId: string }> }>(
    "/lms/classes",
  );
  return payload.classes;
}

export async function getTeacherClasses(user: User) {
  const classes = await getAllClasses();
  const allowedIds = user.taughtClassIds ?? [user.classId];
  return classes.filter((row) => allowedIds.includes(row._id));
}

export async function listSubjectsByClass(classId: string) {
  if (classId) {
    const payload = await getJson<{ subjects: Array<{ _id: string; name: string }> }>(
      `/lms/classes/${encodeURIComponent(classId)}/subjects`,
    );
    return payload.subjects;
  }

  const classesPayload = await getJson<{
    classes: Array<{ _id: string; name: string; mainTeacherId: string }>;
  }>("/lms/classes");
  const subjectPayloads = await Promise.all(
    classesPayload.classes.map((room) =>
      getJson<{ subjects: Array<{ _id: string; name: string }> }>(
        `/lms/classes/${encodeURIComponent(room._id)}/subjects`,
      ),
    ),
  );

  const unique = new Map<string, { _id: string; name: string }>();
  for (const payload of subjectPayloads) {
    for (const subject of payload.subjects) {
      unique.set(subject._id, subject);
    }
  }

  return [...unique.values()];
}

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

export async function listAnnouncementsForClass(classId: string) {
  const all = await listAnnouncementsForUser({} as User);
  return all.filter((announcement) => announcement.classId === classId);
}

export async function listAnnouncementsForUser(_user: User) {
  const payload = await getJson<{ announcements: Announcement[] }>("/lms/users/me/announcements");
  return payload.announcements;
}

export async function createAnnouncement(
  _user: User,
  input: Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
) {
  const payload = await postJson<{ announcement: Announcement }>("/lms/announcements", input);
  return payload.announcement;
}

export async function updateAnnouncement(
  _user: User,
  announcementId: string,
  patch: Partial<Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">>,
) {
  const payload = await patchJson<{ announcement: Announcement }>(
    `/lms/announcements/${encodeURIComponent(announcementId)}`,
    patch,
  );
  return payload.announcement;
}

export async function deleteAnnouncement(_user: User, announcementId: string) {
  await deleteRequest(`/lms/announcements/${encodeURIComponent(announcementId)}`);
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

export async function approveUser(_superAdmin: User, userId: string) {
  await postJson(`/lms/users/${encodeURIComponent(userId)}/approve`, {});
}

export async function assignRole(_superAdmin: User, userId: string, role: User["role"]) {
  await postJson(`/lms/users/${encodeURIComponent(userId)}/role`, { role });
}

export async function assignSubjectTeacher(_superAdmin: User, subjectId: string, teacherId: string) {
  await postJson(`/lms/subjects/${encodeURIComponent(subjectId)}/teacher`, { teacherId });
}

export async function listVisibleProfiles(_user: User) {
  const payload = await getJson<{ profiles: ApiUser[] }>("/lms/profiles");
  return payload.profiles.map(mapUser);
}

export async function updateOwnProfile(
  user: User,
  patch: { name: string; bio: string; profileImage?: File | null },
) {
  const profileImageUrl =
    patch.profileImage === undefined
      ? undefined
      : patch.profileImage === null
        ? null
        : await uploadProfileImage(patch.profileImage, user._id);

  const payload = await patchJson<{ profile: ApiUser }>("/lms/users/me/profile", {
    name: patch.name,
    bio: patch.bio,
    profileImageUrl,
  });
  const updatedUser = mapUser(payload.profile);
  saveSessionUser(updatedUser);
  return updatedUser;
}

export async function listChatThreadsForUser(_user: User): Promise<ChatThread[]> {
  const payload = await getJson<{ threads: ChatThread[] }>("/lms/chats/threads");
  return payload.threads;
}

export async function listMessagesForChat(_user: User, chatId: string) {
  const payload = await getJson<{ messages: Message[] }>(`/lms/chats/${encodeURIComponent(chatId)}/messages`);
  return payload.messages;
}

export async function markChatAsRead(_user: User, chatId: string) {
  await postJson(`/lms/chats/${encodeURIComponent(chatId)}/read`, {});
}

export async function sendMessage(
  _user: User,
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
  const payload = await postJson<{ message: Message }>("/lms/messages/send", input);
  return payload.message;
}

export async function editMessage(_user: User, messageId: string, content: string) {
  const payload = await patchJson<{ message: Message }>(
    `/lms/messages/${encodeURIComponent(messageId)}`,
    { content },
  );
  return payload.message;
}

export async function softDeleteMessage(_user: User, messageId: string) {
  await deleteRequest(`/lms/messages/${encodeURIComponent(messageId)}`);
}

export async function listDirectContacts(_user: User) {
  const payload = await getJson<{ contacts: ApiUser[] }>("/lms/chats/direct-contacts");
  return payload.contacts.map(mapUser);
}
