import type { AppEnv } from "../env";

export type NotificationCategory =
  | "assignment"
  | "submission"
  | "grading"
  | "attendance"
  | "announcement"
  | "message";

export interface NotificationPayload {
  recipientExternalId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  resourceId?: string;
  resourceType?: string;
  actorName?: string;
}

function buildMessage(payload: NotificationPayload) {
  return {
    type: "notification" as const,
    id: `notif-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

export async function enqueueNotification(
  env: AppEnv,
  payload: NotificationPayload,
): Promise<void> {
  try {
    await env.LMS_QUEUE.send(buildMessage(payload));
  } catch (err) {
    console.error("[notify] Failed to enqueue notification", err);
  }
}

export async function enqueueNotifications(
  env: AppEnv,
  payloads: NotificationPayload[],
): Promise<void> {
  if (payloads.length === 0) return;
  try {
    await env.LMS_QUEUE.sendBatch(
      payloads.map((payload) => ({ body: buildMessage(payload) })),
    );
  } catch (err) {
    console.error("[notify] Failed to enqueue notification batch", err);
  }
}
