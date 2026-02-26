import type { Role, User } from "../types";

export const roleLabel: Record<Role, string> = {
  super_admin: "Super Admin",
  main_teacher: "Main Teacher",
  specialized_teacher: "Specialized Teacher",
  administrative_student: "Administrative Student",
  regular_student: "Regular Student",
};

export function isTeacher(user: User) {
  return user.role === "main_teacher" || user.role === "specialized_teacher";
}

export function isSuperAdmin(user: User) {
  return user.role === "super_admin";
}

export function canManageAnnouncements(user: User) {
  return (
    user.role === "main_teacher" ||
    user.role === "specialized_teacher" ||
    user.role === "administrative_student"
  );
}

export function canViewRanking(user: User) {
  return user.role === "main_teacher" || user.role === "specialized_teacher";
}

export function canViewOverallRanking(user: User) {
  return user.role === "main_teacher";
}

export function canAccessSubject(user: User, subjectId: string) {
  if (user.role === "super_admin" || user.role === "main_teacher") {
    return true;
  }
  if (user.role === "specialized_teacher") {
    return user.subjectIds?.includes(subjectId) ?? false;
  }
  return true;
}

export function canGradeSubject(user: User, subjectId: string) {
  if (user.role === "main_teacher") {
    return user.subjectIds?.includes(subjectId) ?? true;
  }
  if (user.role === "specialized_teacher") {
    return user.subjectIds?.includes(subjectId) ?? false;
  }
  return false;
}
