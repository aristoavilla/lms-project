import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppEnv } from "./env";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { lmsRoutes } from "./routes/lms";
import { queueRoutes } from "./routes/queue";
import { storageRoutes } from "./routes/storage";
import { processEventBatch } from "./workers/queueConsumer";

const app = new Hono<{ Bindings: AppEnv }>();

app.use("*", logger());
app.use("*", cors());

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", lmsRoutes);
app.route("/", storageRoutes);
app.route("/", queueRoutes);

app.notFound((c) => c.json({ error: "Route not found" }, 404));

export default {
  fetch: app.fetch,
  queue: processEventBatch,
};
