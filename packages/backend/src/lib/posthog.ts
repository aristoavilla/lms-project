import type { AppEnv } from "../env";

interface PosthogQueueEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

function getDistinctIdFromHeaders(headers: Headers) {
  const cloudflareIp = headers.get("cf-connecting-ip");
  if (cloudflareIp) {
    return `ip:${cloudflareIp}`;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return `ip:${firstIp}`;
    }
  }

  return "backend:anonymous";
}

export function getBackendDistinctId(headers: Headers) {
  return getDistinctIdFromHeaders(headers);
}

export async function queuePosthogEvent(env: AppEnv, event: PosthogQueueEvent) {
  if (!env.POSTHOG_API_KEY) {
    return;
  }

  try {
    await env.LMS_QUEUE.send(event);
  } catch (error) {
    console.error("Failed to enqueue PostHog event", error);
  }
}

export async function captureBackendLog(
  env: AppEnv,
  input: {
    distinctId: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    properties?: Record<string, unknown>;
  },
) {
  await queuePosthogEvent(env, {
    event: "backend_log",
    distinctId: input.distinctId,
    properties: {
      level: input.level,
      message: input.message,
      ...(input.properties ?? {}),
    },
  });
}

export async function captureBackendError(
  env: AppEnv,
  input: {
    distinctId: string;
    error: unknown;
    properties?: Record<string, unknown>;
  },
) {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const stack = input.error instanceof Error ? input.error.stack : undefined;
  const name = input.error instanceof Error ? input.error.name : undefined;

  await queuePosthogEvent(env, {
    event: "$exception",
    distinctId: input.distinctId,
    properties: {
      message,
      stack,
      name,
      source: "backend",
      ...(input.properties ?? {}),
    },
  });
}
