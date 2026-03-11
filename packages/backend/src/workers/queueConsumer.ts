import { PostHog } from "posthog-node";
import { getDb } from "../db/client";
import { notifications } from "../db/schema";
import type { AppEnv } from "../env";

type PosthogMessage = {
  type?: "posthog";
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
};

type NotificationMessage = {
  type: "notification";
  id: string;
  recipientExternalId: string;
  title: string;
  body: string;
  category: string;
  resourceId?: string;
  resourceType?: string;
  actorName?: string;
  createdAt: string;
};

type QueuePayload = PosthogMessage | NotificationMessage;

export async function processEventBatch(batch: MessageBatch<QueuePayload>, env: AppEnv) {
  const posthogMessages: Array<Message<QueuePayload>> = [];
  const notifRows: Array<typeof notifications.$inferInsert> = [];

  for (const message of batch.messages) {
    const body = message.body;
    if (body.type === "notification") {
      notifRows.push({
        id: body.id,
        recipientExternalId: body.recipientExternalId,
        title: body.title,
        body: body.body,
        category: body.category,
        resourceId: body.resourceId ?? null,
        resourceType: body.resourceType ?? null,
        actorName: body.actorName ?? null,
        read: false,
        createdAt: body.createdAt,
      });
      message.ack();
    } else {
      posthogMessages.push(message);
    }
  }

  // Persist notifications to DB
  if (notifRows.length > 0) {
    try {
      const db = getDb(env);
      await db.insert(notifications).values(notifRows).onConflictDoNothing();
    } catch (err) {
      console.error("[queue] Failed to persist notifications:", err);
    }
  }

  // Forward PostHog analytics events
  if (posthogMessages.length === 0) return;
  if (!env.POSTHOG_API_KEY) {
    for (const msg of posthogMessages) msg.ack();
    return;
  }

  const posthog = new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });

  try {
    for (const msg of posthogMessages) {
      const ev = msg.body as PosthogMessage;
      posthog.capture({
        event: ev.event,
        distinctId: ev.distinctId,
        properties: ev.properties,
      });
      msg.ack();
    }
    await posthog.flush();
  } finally {
    await posthog.shutdown();
  }
}
