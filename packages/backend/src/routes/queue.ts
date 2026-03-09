import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";

const eventSchema = z.object({
  event: z.string().min(1),
  distinctId: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const queueRoutes = new Hono<{ Bindings: AppEnv }>();

queueRoutes.post("/events", zValidator("json", eventSchema), async (c) => {
  const payload = c.req.valid("json");
  await c.env.LMS_QUEUE.send(payload);
  return c.json({ queued: true });
});
