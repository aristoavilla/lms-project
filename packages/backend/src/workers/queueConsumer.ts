import { PostHog } from "posthog-node";
import type { AppEnv } from "../env";

interface EventPayload {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export async function processEventBatch(batch: MessageBatch<EventPayload>, env: AppEnv) {
  if (!env.POSTHOG_API_KEY) {
    for (const message of batch.messages) {
      message.ack();
    }
    return;
  }

  const posthog = new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });

  try {
    for (const message of batch.messages) {
      const event = message.body;
      posthog.capture({
        event: event.event,
        distinctId: event.distinctId,
        properties: event.properties,
      });
      message.ack();
    }
    await posthog.flush();
  } finally {
    await posthog.shutdown();
  }
}
