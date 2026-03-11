import posthog from "posthog-js";

const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ?? "https://app.posthog.com";
const enabled = ((import.meta.env.VITE_PUBLIC_POSTHOG_ENABLED as string | undefined) ?? "true") !== "false";

let initialized = false;
let globalHandlersRegistered = false;

interface PosthogUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  classId?: string;
  subjectId?: string;
}

function canUsePosthog() {
  return enabled && initialized;
}

function toErrorProperties(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(context ?? {}),
    };
  }

  return {
    message: String(error),
    ...(context ?? {}),
  };
}

function registerGlobalErrorHandlers() {
  if (globalHandlersRegistered || typeof window === "undefined") {
    return;
  }

  window.addEventListener("error", (event) => {
    captureError(event.error ?? event.message, {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason, { source: "window.unhandledrejection" });
  });

  globalHandlersRegistered = true;
}

export function initPosthog() {
  if (initialized || !key || !enabled) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: false,
    capture_exceptions: true,
  });

  initialized = true;
  registerGlobalErrorHandlers();
}

export function identifyPosthogUser(user: PosthogUser) {
  if (!canUsePosthog()) {
    return;
  }

  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    role: user.role,
    classId: user.classId,
    subjectId: user.subjectId,
  });

  if (user.classId) {
    posthog.group("class", user.classId, {
      classId: user.classId,
    });
  }
}

export function resetPosthogUser() {
  if (!canUsePosthog()) {
    return;
  }
  posthog.reset();
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (!canUsePosthog()) {
    return;
  }
  posthog.capture(event, properties);
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!canUsePosthog()) {
    return;
  }
  posthog.capture("$exception", toErrorProperties(error, context));
}

export function captureLog(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
) {
  if (!canUsePosthog()) {
    return;
  }
  posthog.capture("app_log", {
    level,
    message,
    ...(context ?? {}),
  });
}

export function isFeatureEnabled(flagKey: string) {
  if (!canUsePosthog()) {
    return false;
  }
  return Boolean(posthog.isFeatureEnabled(flagKey));
}

export function getFeatureFlagPayload(flagKey: string) {
  if (!canUsePosthog()) {
    return null;
  }
  return posthog.getFeatureFlagPayload(flagKey);
}

export function reloadFeatureFlags() {
  if (!canUsePosthog()) {
    return;
  }
  posthog.reloadFeatureFlags();
}
