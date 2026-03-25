import type { User } from "../../types";
import { getJson, mapUser, type ApiUser } from "./core";

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

export async function listVisibleProfiles(_user: User) {
  const payload = await getJson<{ profiles: ApiUser[] }>("/lms/profiles");
  return payload.profiles.map(mapUser);
}