import type { User } from "../../types";
import { postJson } from "./core";

export async function approveUser(_superAdmin: User, userId: string) {
  await postJson(`/lms/users/${encodeURIComponent(userId)}/approve`, {});
}

export async function assignRole(_superAdmin: User, userId: string, role: User["role"]) {
  await postJson(`/lms/users/${encodeURIComponent(userId)}/role`, { role });
}

export async function assignSubjectTeacher(_superAdmin: User, subjectId: string, teacherId: string) {
  await postJson(`/lms/subjects/${encodeURIComponent(subjectId)}/teacher`, { teacherId });
}