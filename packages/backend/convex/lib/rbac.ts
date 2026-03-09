import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type Role =
  | "super_admin"
  | "main_teacher"
  | "specialized_teacher"
  | "administrative_student"
  | "regular_student";

export async function requireApprovedUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || user.approved !== true) {
    throw new Error("User is not approved.");
  }
  return user;
}

export function requireRole(currentRole: Role, allowed: Role[]) {
  if (!allowed.includes(currentRole)) {
    throw new Error("Forbidden for this role.");
  }
}

export async function requireSubjectInClass(
  ctx: QueryCtx | MutationCtx,
  subjectId: Id<"subjects">,
  classId: Id<"class">,
) {
  const subject = await ctx.db.get(subjectId);
  if (!subject || subject.classId !== classId) {
    throw new Error("Subject is not available in this class.");
  }
  return subject;
}

export function requireSubjectOwner(
  requester: Doc<"users">,
  subject: Doc<"subjects">,
) {
  if (subject.teacherId !== requester._id) {
    throw new Error("Only the subject owner can perform this action.");
  }
}
