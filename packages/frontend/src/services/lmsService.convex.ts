import { ConvexHttpClient } from "convex/browser";
import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  Chat,
  ChatThread,
  FileAsset,
  Message,
  RankedStudent,
  Subject,
  Submission,
  SubmissionType,
  User,
} from "../types";
import * as local from "./lmsService.local.ts";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;
const SESSION_USER_KEY = "lms:session:userId";
const SESSION_USER_OBJECT_KEY = "lms:convex:sessionUser";
const REMOTE_TIMEOUT_MS = 45000;
const SEED_TIMEOUT_MS = 60000;
const CONVEX_FAILURE_BACKOFF_MS = 30000;

let seedPromise: Promise<void> | null = null;
let seedChecked = false;
let convexRetryAtMs = 0;

function isConvexConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch") ||
    message.includes("backend")
  );
}

function shouldPreferLocalFallback() {
  return convexRetryAtMs > Date.now();
}

function markConvexFailure() {
  convexRetryAtMs = Date.now() + CONVEX_FAILURE_BACKOFF_MS;
  seedPromise = null;
  seedChecked = false;
}

function clearConvexFailure() {
  convexRetryAtMs = 0;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function saveSessionUser(user: User | null) {
  if (!canUseLocalStorage()) {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(SESSION_USER_KEY);
    window.localStorage.removeItem(SESSION_USER_OBJECT_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_USER_KEY, user._id);
  window.localStorage.setItem(SESSION_USER_OBJECT_KEY, JSON.stringify(user));
}

function getStoredSessionUser(): User | undefined {
  if (!canUseLocalStorage()) {
    return undefined;
  }
  const raw = window.localStorage.getItem(SESSION_USER_OBJECT_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return undefined;
  }
}

async function ensureSeeded() {
  if (!convexClient) {
    return;
  }
  if (seedChecked) {
    return;
  }
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        await Promise.race([
          convexClient.mutation("client:ensureSeeded" as never, {} as never),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("Convex seed request timed out."));
            }, SEED_TIMEOUT_MS);
          }),
        ]);
      } catch (error) {
        // Allow retry on next request after transient bootstrap failures.
        seedPromise = null;
        throw error;
      }
    })();
  }
  await seedPromise;
  seedChecked = true;
}

async function queryConvex<T>(
  name: string,
  args: Record<string, unknown>,
  options?: { skipSeed?: boolean },
) {
  if (!convexClient) {
    throw new Error("Convex backend is not configured. Set VITE_CONVEX_URL.");
  }
  if (!options?.skipSeed) {
    await ensureSeeded();
  }
  return (await Promise.race([
    convexClient.query(name as never, args as never),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Convex request timed out."));
      }, REMOTE_TIMEOUT_MS);
    }),
  ])) as T;
}

async function mutateConvex<T>(
  name: string,
  args: Record<string, unknown>,
  options?: { skipSeed?: boolean },
) {
  if (!convexClient) {
    throw new Error("Convex backend is not configured. Set VITE_CONVEX_URL.");
  }
  if (!options?.skipSeed) {
    await ensureSeeded();
  }
  return (await Promise.race([
    convexClient.mutation(name as never, args as never),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Convex request timed out."));
      }, REMOTE_TIMEOUT_MS);
    }),
  ])) as T;
}

async function withConvexFallback<T>(
  remoteFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T,
  options?: {
    fallbackOnConnectionError?: boolean;
    operationLabel?: string;
  },
): Promise<T> {
  const fallbackOnConnectionError = options?.fallbackOnConnectionError ?? true;
  const operationLabel = options?.operationLabel ?? "operation";

  if (!convexClient) {
    return await fallbackFn();
  }
  if (shouldPreferLocalFallback()) {
    if (!fallbackOnConnectionError) {
      throw new Error(
        `Convex is temporarily unavailable while performing ${operationLabel}. Please retry after a moment.`,
      );
    }
    return await fallbackFn();
  }
  try {
    const remote = await remoteFn();
    clearConvexFailure();
    return remote;
  } catch (error) {
    if (!isConvexConnectionError(error)) {
      throw error;
    }
    markConvexFailure();
    if (!fallbackOnConnectionError) {
      throw new Error(
        `Convex connection failed during ${operationLabel}. Changes were not saved locally to avoid temporary-only data.`,
      );
    }
    return await fallbackFn();
  }
}

async function withStrictConvexChat<T>(remoteFn: () => Promise<T>, fallbackFn: () => Promise<T> | T): Promise<T> {
  if (!convexClient) {
    return await fallbackFn();
  }
  return await remoteFn();
}

function requireSessionUser() {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    throw new Error("No active session user.");
  }
  return sessionUser;
}

export function getDefaultSeededPassword() {
  return local.getDefaultSeededPassword();
}

export function getSessionUser() {
  if (!convexClient) {
    return local.getSessionUser();
  }
  return getStoredSessionUser();
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password?: string;
  provider: "email" | "oauth";
  classId?: string;
}) {
  return await withConvexFallback(
    async () => {
      const created = await mutateConvex<User>("client:registerAccount", {
        name: input.name,
        email: input.email,
        password: input.password,
        classId: input.classId,
      });
      saveSessionUser(created);
      return created;
    },
    () => local.registerAccount(input),
    { fallbackOnConnectionError: false, operationLabel: "account registration" },
  );
}

export async function loginWithEmail(emailInput: string, passwordInput: string) {
  return await withConvexFallback(
    async () => {
      const user = await mutateConvex<User>("client:loginWithEmail", {
        email: emailInput,
        password: passwordInput,
      });
      saveSessionUser(user);
      return user;
    },
    () => local.loginWithEmail(emailInput, passwordInput),
  );
}

export async function loginWithOAuth(emailInput: string) {
  return await withConvexFallback(
    async () => {
      const user = await queryConvex<User>("client:loginWithOAuth", {
        email: emailInput,
      });
      saveSessionUser(user);
      return user;
    },
    () => local.loginWithOAuth(emailInput),
  );
}

export async function logout(activeUserId?: string) {
  saveSessionUser(null);
  if (!convexClient) {
    await local.logout(activeUserId);
  }
}

export function currentUserQuery(userId: string) {
  if (!convexClient) {
    return local.currentUserQuery(userId);
  }
  const sessionUser = getStoredSessionUser();
  if (sessionUser && sessionUser._id === userId) {
    return sessionUser;
  }
  return undefined;
}

export async function getAllUsers() {
  return await withConvexFallback(
    async () => {
      const sessionUser = requireSessionUser();
      return await queryConvex<User[]>("client:listUsers", {
        requesterId: sessionUser._id,
      });
    },
    () => Promise.resolve(local.getAllUsers()),
  );
}

export function getAllClasses() {
  return local.getAllClasses();
}

export function getTeacherClasses(user: User) {
  return local.getTeacherClasses(user);
}

export async function listSubjectsByClass(classId: string) {
  return await withConvexFallback(
    () => queryConvex<Subject[]>("client:listSubjectsByClass", { classId: classId || undefined }),
    () => local.listSubjectsByClass(classId),
  );
}

export async function listAssignmentsForUser(user: User) {
  return await withConvexFallback(
    () => queryConvex<Assignment[]>("client:listAssignmentsForUser", { requesterId: user._id }),
    () => local.listAssignmentsForUser(user),
  );
}

export async function createAssignment(
  teacher: User,
  input: Pick<Assignment, "title" | "description" | "subjectId" | "classId" | "deadline" | "totalScore">,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:createAssignment", {
        requesterId: teacher._id,
        ...input,
      }),
    () => local.createAssignment(teacher, input),
    { fallbackOnConnectionError: false, operationLabel: "assignment creation" },
  );
}

export async function listAnnouncementsForClass(classId: string) {
  return await local.listAnnouncementsForClass(classId);
}

export async function listAnnouncementsForUser(user: User) {
  return await withConvexFallback(
    () => queryConvex<Announcement[]>("client:listAnnouncementsForUser", { requesterId: user._id }),
    () => local.listAnnouncementsForUser(user),
  );
}

export async function createAnnouncement(
  user: User,
  input: Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
) {
  return await withConvexFallback(
    () =>
      mutateConvex<Announcement>("client:createAnnouncement", {
        requesterId: user._id,
        title: input.title,
        content: input.content,
        attachment: input.attachment,
        scheduledAt: input.scheduledAt,
      }),
    () => local.createAnnouncement(user, input),
    { fallbackOnConnectionError: false, operationLabel: "announcement creation" },
  );
}

export async function updateAnnouncement(
  user: User,
  announcementId: string,
  patch: Pick<Announcement, "title" | "content">,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:updateAnnouncement", {
        requesterId: user._id,
        announcementId,
        title: patch.title,
        content: patch.content,
      }),
    () => local.updateAnnouncement(user, announcementId, patch),
    { fallbackOnConnectionError: false, operationLabel: "announcement update" },
  );
}

export async function deleteAnnouncement(user: User, announcementId: string) {
  await withConvexFallback(
    () =>
      mutateConvex("client:deleteAnnouncement", {
        requesterId: user._id,
        announcementId,
      }),
    () => local.deleteAnnouncement(user, announcementId),
    { fallbackOnConnectionError: false, operationLabel: "announcement deletion" },
  );
}

export async function submitAssignment(
  user: User,
  assignmentId: string,
  payload: string,
  submissionType: SubmissionType,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:submitAssignment", {
        requesterId: user._id,
        assignmentId,
        payload,
        submissionType,
      }),
    () => local.submitAssignment(user, assignmentId, payload, submissionType),
    { fallbackOnConnectionError: false, operationLabel: "assignment submission" },
  );
}

export async function gradeSubmission(
  teacher: User,
  submissionId: string,
  score: number,
  comment: string,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:gradeSubmission", {
        requesterId: teacher._id,
        submissionId,
        score,
        comment,
      }),
    () => local.gradeSubmission(teacher, submissionId, score, comment),
    { fallbackOnConnectionError: false, operationLabel: "submission grading" },
  );
}

export async function listAttendance(user: User) {
  return await withConvexFallback(
    () => queryConvex<AttendanceRecord[]>("client:listAttendance", { requesterId: user._id }),
    () => local.listAttendance(user),
  );
}

export async function markAttendance(
  teacher: User,
  input: Omit<AttendanceRecord, "_id" | "semesterId">,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:markAttendance", {
        requesterId: teacher._id,
        ...input,
      }),
    () => local.markAttendance(teacher, input),
    { fallbackOnConnectionError: false, operationLabel: "attendance mark" },
  );
}

export async function getSubjectRanking(
  user: User,
  subjectId: string,
  classId: string,
): Promise<RankedStudent[]> {
  return await withConvexFallback(
    () =>
      queryConvex<RankedStudent[]>("client:getSubjectRanking", {
        requesterId: user._id,
        subjectId,
        classId,
      }),
    () => local.getSubjectRanking(user, subjectId, classId),
  );
}

export async function getOverallRanking(user: User, classId?: string) {
  return await withConvexFallback(
    () =>
      queryConvex<RankedStudent[]>("client:getOverallRanking", {
        requesterId: user._id,
        classId,
      }),
    () => local.getOverallRanking(user, classId),
  );
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  return await withConvexFallback(
    () => {
      const sessionUser = requireSessionUser();
      return queryConvex<Submission[]>("client:listSubmissionsForAssignment", {
        requesterId: sessionUser._id,
        assignmentId,
      });
    },
    () => local.listSubmissionsForAssignment(assignmentId),
  );
}

export async function getSubmissionDetail(teacher: User, submissionId: string) {
  return await withConvexFallback(
    () =>
      queryConvex<{ submission: Submission; assignment: Assignment; student: User }>(
        "client:getSubmissionDetail",
        {
          requesterId: teacher._id,
          submissionId,
        },
      ),
    () => local.getSubmissionDetail(teacher, submissionId),
  );
}

export async function approveUser(superAdmin: User, userId: string) {
  await withConvexFallback(
    () => mutateConvex("client:approveUser", { requesterId: superAdmin._id, userId }),
    () => local.approveUser(superAdmin, userId),
    { fallbackOnConnectionError: false, operationLabel: "user approval" },
  );
}

export async function assignRole(superAdmin: User, userId: string, role: User["role"]) {
  await withConvexFallback(
    () => mutateConvex("client:assignRole", { requesterId: superAdmin._id, userId, role }),
    () => local.assignRole(superAdmin, userId, role),
    { fallbackOnConnectionError: false, operationLabel: "role assignment" },
  );
}

export async function assignSubjectTeacher(
  superAdmin: User,
  subjectId: string,
  teacherId: string,
) {
  await withConvexFallback(
    () =>
      mutateConvex("client:assignSubjectTeacher", {
        requesterId: superAdmin._id,
        subjectId,
        teacherId,
      }),
    () => local.assignSubjectTeacher(superAdmin, subjectId, teacherId),
    { fallbackOnConnectionError: false, operationLabel: "subject teacher assignment" },
  );
}

export async function listVisibleProfiles(user: User) {
  return await withConvexFallback(
    () => queryConvex<User[]>("client:listVisibleProfiles", { requesterId: user._id }),
    () => local.listVisibleProfiles(user),
  );
}

export async function updateOwnProfile(
  user: User,
  patch: { name: string; bio: string; profileImage?: File | null },
) {
  return await withConvexFallback(
    async () => {
      const profileImageId =
        patch.profileImage && patch.profileImage !== null
          ? await uploadFileToConvexStorage(patch.profileImage)
          : undefined;

      return await mutateConvex<User>("client:updateOwnProfile", {
        requesterId: user._id,
        name: patch.name,
        bio: patch.bio,
        profileImageId,
        clearProfileImage: patch.profileImage === null,
      });
    },
    () => local.updateOwnProfile(user, patch),
    { fallbackOnConnectionError: false, operationLabel: "profile update" },
  ).then((updated) => {
    // Keep the in-browser Convex session cache in sync with profile edits.
    if (updated) {
      saveSessionUser(updated);
    }
    return updated;
  });
}

async function uploadFileToConvexStorage(file: File): Promise<string> {
  const uploadUrl = await mutateConvex<string>("client:generateUploadUrl", {});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload profile image to Convex storage.");
  }

  const payload = (await response.json()) as { storageId?: string };
  if (!payload.storageId) {
    throw new Error("Convex upload response did not include a storage ID.");
  }
  return payload.storageId;
}

export async function listChatThreadsForUser(user: User) {
  return await withStrictConvexChat(
    () => queryConvex<ChatThread[]>("chats:listThreads", { requesterId: user._id }, { skipSeed: true }),
    () => local.listChatThreadsForUser(user),
  );
}

export async function listMessagesForChat(user: User, chatId: string) {
  return await withStrictConvexChat(
    () =>
      queryConvex<Message[]>("chats:listMessages", { requesterId: user._id, chatId }, { skipSeed: true }),
    () => local.listMessagesForChat(user, chatId),
  );
}

export async function markChatAsRead(user: User, chatId: string) {
  await withStrictConvexChat(
    () => mutateConvex("chats:markRead", { requesterId: user._id, chatId }, { skipSeed: true }),
    () => local.markChatAsRead(user, chatId),
  );
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
  return await withStrictConvexChat(
    () =>
      mutateConvex<Message>("chats:send", {
        requesterId: user._id,
        chatId: input.chatId,
        type: input.type,
        classId: input.classId,
        subjectId: input.subjectId,
        recipientId: input.recipientUserId,
        content: input.content,
        attachment: input.attachment ? JSON.stringify(input.attachment) : undefined,
      }, { skipSeed: true }),
    () => local.sendMessage(user, input),
  );
}

export async function editMessage(user: User, messageId: string, content: string) {
  await withStrictConvexChat(
    () =>
      mutateConvex("chats:editOwn", {
        requesterId: user._id,
        messageId,
        content,
      }, { skipSeed: true }),
    () => local.editMessage(user, messageId, content),
  );
}

export async function softDeleteMessage(user: User, messageId: string) {
  await withStrictConvexChat(
    () =>
      mutateConvex("chats:softDeleteOwn", {
        requesterId: user._id,
        messageId,
      }, { skipSeed: true }),
    () => local.softDeleteMessage(user, messageId),
  );
}

export async function listDirectContacts(user: User) {
  return await withStrictConvexChat(
    () => queryConvex<User[]>("chats:listDirectContacts", { requesterId: user._id }, { skipSeed: true }),
    () => local.listDirectContacts(user),
  );
}
