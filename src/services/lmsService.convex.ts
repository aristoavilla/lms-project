import { ConvexHttpClient } from "convex/browser";
import type {
  Announcement,
  Assignment,
  AttendanceRecord,
  FileAsset,
  RankedStudent,
  Subject,
  Submission,
  SubmissionType,
  User,
} from "../types";
import * as local from "./lmsService.local";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;
const SESSION_USER_KEY = "lms:session:userId";
const SESSION_USER_OBJECT_KEY = "lms:convex:sessionUser";

let seedPromise: Promise<void> | null = null;

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
  if (!seedPromise) {
    seedPromise = convexClient
      .mutation("client:ensureSeeded" as never, {} as never)
      .then(() => undefined);
  }
  await seedPromise;
}

async function queryConvex<T>(name: string, args: Record<string, unknown>) {
  if (!convexClient) {
    throw new Error("Convex backend is not configured. Set VITE_CONVEX_URL.");
  }
  await ensureSeeded();
  return (await convexClient.query(name as never, args as never)) as T;
}

async function mutateConvex<T>(name: string, args: Record<string, unknown>) {
  if (!convexClient) {
    throw new Error("Convex backend is not configured. Set VITE_CONVEX_URL.");
  }
  await ensureSeeded();
  return (await convexClient.mutation(name as never, args as never)) as T;
}

async function withConvexFallback<T>(
  remoteFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T,
): Promise<T> {
  if (!convexClient) {
    return await fallbackFn();
  }
  try {
    return await remoteFn();
  } catch {
    return await fallbackFn();
  }
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
  );
}

export async function assignRole(superAdmin: User, userId: string, role: User["role"]) {
  await withConvexFallback(
    () => mutateConvex("client:assignRole", { requesterId: superAdmin._id, userId, role }),
    () => local.assignRole(superAdmin, userId, role),
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
  patch: { name: string; bio: string; profileImage?: FileAsset | null },
) {
  return await withConvexFallback(
    () =>
      mutateConvex<User>("client:updateOwnProfile", {
        requesterId: user._id,
        name: patch.name,
        bio: patch.bio,
        profileImageUrl: patch.profileImage?.url,
        profileImageId: patch.profileImage?.id,
      }),
    () => local.updateOwnProfile(user, patch),
  );
}

export const listChatThreadsForUser = local.listChatThreadsForUser;
export const listMessagesForChat = local.listMessagesForChat;
export const markChatAsRead = local.markChatAsRead;
export const sendMessage = local.sendMessage;
export const editMessage = local.editMessage;
export const softDeleteMessage = local.softDeleteMessage;
export const listDirectContacts = local.listDirectContacts;
