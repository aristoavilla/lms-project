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

export function getSessionUser() {
  return getSessionUserFromStorage();
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

  localStore.userState = [created, ...localStore.userState];
  if (input.provider === "email" && password) {
    localStore.passwordState.set(email, password);
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
    const user = localStore.userState.find((candidate) => candidate._id === activeUserId);
    if (user) {
      clearAttemptState(user.email);
    }
  }
  setSessionUser(null);
}
