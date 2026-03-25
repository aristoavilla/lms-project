import { captureEvent, captureLog } from "../posthog";
import {
  clearSession,
  getStoredSessionUser,
  getDefaultSeededPassword,
  getSessionToken,
  hasSessionToken,
  mapUser,
  parseApiError,
  postPublicJson,
  requireApiBaseUrl,
  saveSessionToken,
  saveSessionUser,
  SESSION_USER_UPDATED_EVENT,
  type ApiUser,
} from "./core";

export { getDefaultSeededPassword, hasSessionToken, SESSION_USER_UPDATED_EVENT };

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
    captureLog("warn", "Session restore failed", { message, status: response.status });
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
  captureEvent("user_login", {
    method: "email",
    userId: user._id,
    role: user.role,
    classId: user.classId,
  });
  return user;
}

export async function loginWithOAuth(email: string) {
  const payload = await postPublicJson<{ token: string; user: ApiUser }>("/auth/oauth", {
    email,
  });
  const user = mapUser(payload.user);
  saveSessionToken(payload.token);
  saveSessionUser(user);
  captureEvent("user_login", {
    method: "oauth",
    userId: user._id,
    role: user.role,
    classId: user.classId,
  });
  return user;
}

export async function logout() {
  const user = getStoredSessionUser();
  if (user) {
    captureEvent("user_logout", {
      userId: user._id,
      role: user.role,
      classId: user.classId,
    });
  }
  clearSession();
}
