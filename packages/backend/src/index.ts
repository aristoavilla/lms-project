import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppEnv } from "./env";
import { captureBackendError, captureBackendLog, getBackendDistinctId, queuePosthogEvent } from "./lib/posthog";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { lmsRoutes } from "./routes/lms";
import { queueRoutes } from "./routes/queue";
import { storageRoutes } from "./routes/storage";
import { processEventBatch } from "./workers/queueConsumer";

const app = new Hono<{ Bindings: AppEnv }>();

app.use("*", logger());
app.use("*", cors());
app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const distinctId = getBackendDistinctId(c.req.raw.headers);

  try {
    await next();
  } catch (error) {
    await captureBackendError(c.env, {
      distinctId,
      error,
      properties: {
        route: c.req.path,
        method: c.req.method,
      },
    });
    throw error;
  } finally {
    const durationMs = Date.now() - startedAt;
    const status = c.res.status;

    await queuePosthogEvent(c.env, {
      event: "api_request",
      distinctId,
      properties: {
        method: c.req.method,
        path: c.req.path,
        status,
        durationMs,
      },
    });

    await captureBackendLog(c.env, {
      distinctId,
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      message: "API request completed",
      properties: {
        method: c.req.method,
        path: c.req.path,
        status,
        durationMs,
      },
    });
  }
});

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", lmsRoutes);
app.route("/", storageRoutes);
app.route("/", queueRoutes);

app.onError(async (error, c) => {
  const distinctId = getBackendDistinctId(c.req.raw.headers);
  await captureBackendError(c.env, {
    distinctId,
    error,
    properties: {
      route: c.req.path,
      method: c.req.method,
      phase: "onError",
    },
  });
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Route not found" }, 404));

export default {
  fetch: app.fetch,
  queue: processEventBatch,
};
