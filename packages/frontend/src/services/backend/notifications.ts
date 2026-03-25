import type { Notification } from "../../types";
import { getJson, postJson } from "./core";

export async function getNotifications(): Promise<Notification[]> {
  const payload = await getJson<{ notifications: Notification[] }>("/lms/notifications");
  return payload.notifications;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await postJson<void>(`/lms/notifications/${encodeURIComponent(notificationId)}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await postJson<void>("/lms/notifications/read-all", {});
}