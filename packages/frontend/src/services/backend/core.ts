import type {
  Assignment,
  AttendanceRecord,
  Submission,
  SubmissionType,
  User,
} from "../../types";
import { captureError, captureLog } from "../posthog";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const SESSION_TOKEN_KEY = "lms:session:token";
const SESSION_USER_KEY = "lms:session:user";
export const SESSION_USER_UPDATED_EVENT = "lms:session-user-updated";
const DEFAULT_DEMO_PASSWORD = "Password123!";

export interface ApiUser {
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

export function getDefaultSeededPassword() {
  return DEFAULT_DEMO_PASSWORD;
}

export function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("Backend API base URL is not configured.");
  }
  return API_BASE_URL;
}

export function getSessionToken() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string | null) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  if (!token) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function saveSessionUser(user: User | null) {
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

export function clearSession() {
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

export function getStoredSessionUser() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return undefined;
  }
  return parseStoredUser(window.localStorage.getItem(SESSION_USER_KEY));
}

export function hasSessionToken() {
  return Boolean(getSessionToken());
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
    captureError(error, { source: "api_request", unauthorized });
    captureLog("error", "API request failed", { message, unauthorized });
    if (unauthorized) {
      clearSession();
      throw new Error("Your session expired or is invalid. Please login again.");
    }
    throw error;
  }
}

export async function parseApiError(response: Response) {
  const fallback = `Request failed with status ${response.status}.`;
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getJson<T>(path: string): Promise<T> {
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

export async function postJson<T>(path: string, body: unknown): Promise<T> {
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

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
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

export async function deleteRequest(path: string): Promise<void> {
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

export async function postPublicJson<T>(path: string, body: unknown): Promise<T> {
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

export function mapUser(user: ApiUser): User {
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

export async function uploadProfileImage(file: File, userId: string) {
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

export function mapAssignment(assignment: {
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

export function mapSubmission(submission: {
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

export function mapAttendance(record: {
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