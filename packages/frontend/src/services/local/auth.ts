import type { User } from "../../types";
import {
  clearAttemptState,
  delay,
  ensureAuthStateInitialized,
  ensureNotRateLimited,
  findUserByEmail,
  getDefaultSeededPassword,
  getSessionUserFromStorage,
  localStore,
  nextUserId,
  normalizeEmail,
  registerFailedAttempt,
  setSessionUser,
  classes,
} from "./core";

export { getDefaultSeededPassword };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const SESSION_TOKEN_KEY = "lms:session:token";

interface BackendUser {
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

function canUseBackendAuth() {
  return Boolean(API_BASE_URL);
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Backend API base URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
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

function upsertBackendUser(user: BackendUser): User {
  const mapped: User = {
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

  const existingIndex = localStore.userState.findIndex((candidate) => candidate._id === mapped._id);
  if (existingIndex >= 0) {
    localStore.userState[existingIndex] = {
      ...localStore.userState[existingIndex],
      ...mapped,
    };
    return localStore.userState[existingIndex];
  }

  localStore.userState = [mapped, ...localStore.userState];
  return mapped;
}

function saveSessionToken(token: string | null) {
  if (!canUseLocalStorage()) {
    return;
  }
  if (!token) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

function getSessionToken() {
  if (!canUseLocalStorage()) {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function getSessionUser() {
  return getSessionUserFromStorage();
}

export async function restoreSessionUser() {
  const existing = getSessionUserFromStorage();
  if (existing) {
    return existing;
  }

  if (!canUseBackendAuth()) {
    return undefined;
  }

  const token = getSessionToken();
  if (!token || !API_BASE_URL) {
    return undefined;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      saveSessionToken(null);
      setSessionUser(null);
      return undefined;
    }

    const payload = (await response.json()) as { user: BackendUser };
    const restored = upsertBackendUser(payload.user);
    setSessionUser(restored._id);
    return restored;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password?: string;
  provider: "email" | "oauth";
  classId?: string;
}) {
  if (canUseBackendAuth() && input.provider === "email") {
    const payload = await postJson<{ user: BackendUser }>("/auth/register", {
      name: input.name,
      email: input.email,
      password: input.password,
      classId: input.classId,
    });
    return upsertBackendUser(payload.user);
  }

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

  localStore.userState = [created, ...localStore.userState];
  if (input.provider === "email" && password) {
    localStore.passwordState.set(email, password);
  }
  return created;
}

export async function loginWithEmail(emailInput: string, passwordInput: string) {
  if (canUseBackendAuth()) {
    const payload = await postJson<{ token: string; user: BackendUser }>("/auth/login", {
      email: emailInput,
      password: passwordInput,
    });
    const user = upsertBackendUser(payload.user);
    setSessionUser(user._id);
    saveSessionToken(payload.token);
    return user;
  }

  await delay(140);
  ensureAuthStateInitialized();

  const email = normalizeEmail(emailInput);
  const password = passwordInput.trim();
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  ensureNotRateLimited(email);
  const user = findUserByEmail(email);
  const storedPassword = localStore.passwordState.get(email);

  if (!user || !storedPassword || storedPassword !== password) {
    registerFailedAttempt(email);
    throw new Error("Invalid email or password.");
  }

  clearAttemptState(email);
  setSessionUser(user._id);
  return user;
}

export async function loginWithOAuth(emailInput: string) {
  if (canUseBackendAuth()) {
    const payload = await postJson<{ token: string; user: BackendUser }>("/auth/oauth", {
      email: emailInput,
    });
    const user = upsertBackendUser(payload.user);
    setSessionUser(user._id);
    saveSessionToken(payload.token);
    return user;
  }

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
  saveSessionToken(null);
  await delay(50);
  if (activeUserId) {
    const user = localStore.userState.find((candidate) => candidate._id === activeUserId);
    if (user) {
      clearAttemptState(user.email);
    }
  }
  setSessionUser(null);
}
