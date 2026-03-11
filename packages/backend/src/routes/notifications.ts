import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db/client";
import { notifications, users } from "../db/schema";
import type { AppEnv } from "../env";
import { verifyAccessToken } from "../lib/auth";

export const notificationRoutes = new Hono<{ Bindings: AppEnv }>();

async function getNotifUser(c: { req: { header: (name: string) => string | undefined }; env: AppEnv }) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const payload = await verifyAccessToken(c.env, token);
    const userId = payload.sub;
    if (typeof userId !== "string") return null;
    const db = getDb(c.env);
    const [row] = await db
      .select({ id: users.id, externalId: users.externalId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return null;
    return { recipientId: row.externalId ?? row.id };
  } catch {
    return null;
  }
}

notificationRoutes.get("/lms/notifications", async (c) => {
  const auth = await getNotifUser(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientExternalId, auth.recipientId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return c.json({
    notifications: rows.map((row) => ({
      _id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      resourceId: row.resourceId ?? undefined,
      resourceType: row.resourceType ?? undefined,
      actorName: row.actorName ?? undefined,
      read: row.read,
      createdAt: row.createdAt,
    })),
  });
});

notificationRoutes.post("/lms/notifications/read-all", async (c) => {
  const auth = await getNotifUser(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c.env);
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.recipientExternalId, auth.recipientId));

  return c.body(null, 204);
});

notificationRoutes.post("/lms/notifications/:id/read", async (c) => {
  const auth = await getNotifUser(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c.env);
  const notifId = c.req.param("id");
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notifId),
        eq(notifications.recipientExternalId, auth.recipientId),
      ),
    );

  return c.body(null, 204);
});
