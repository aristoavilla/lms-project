import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { verifyAccessToken } from "../lib/auth";

const eventSchema = z.object({
  event: z.string().min(1),
  distinctId: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const queueRoutes = new Hono<{ Bindings: AppEnv }>();

queueRoutes.post("/events", zValidator("json", eventSchema), async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    await verifyAccessToken(c.env, authHeader.slice("Bearer ".length).trim());
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = c.req.valid("json");
  await c.env.LMS_QUEUE.send({ type: "posthog", ...payload });
  return c.json({ queued: true });
});
