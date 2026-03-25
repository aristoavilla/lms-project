import type { Announcement, User } from "../../types";
import { deleteRequest, getJson, patchJson, postJson } from "./core";

export async function listAnnouncementsForClass(classId: string) {
  const all = await listAnnouncementsForUser({} as User);
  return all.filter((announcement) => announcement.classId === classId);
}

export async function listAnnouncementsForUser(_user: User) {
  const payload = await getJson<{ announcements: Announcement[] }>("/lms/users/me/announcements");
  return payload.announcements;
}

export async function createAnnouncement(
  _user: User,
  input: Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
) {
  const payload = await postJson<{ announcement: Announcement }>("/lms/announcements", input);
  return payload.announcement;
}

export async function updateAnnouncement(
  _user: User,
  announcementId: string,
  patch: Partial<Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">>,
) {
  const payload = await patchJson<{ announcement: Announcement }>(
    `/lms/announcements/${encodeURIComponent(announcementId)}`,
    patch,
  );
  return payload.announcement;
}

export async function deleteAnnouncement(_user: User, announcementId: string) {
  await deleteRequest(`/lms/announcements/${encodeURIComponent(announcementId)}`);
}