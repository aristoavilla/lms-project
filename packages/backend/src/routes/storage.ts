import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { verifyAccessToken } from "../lib/auth";

const uploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  dataBase64: z.string().min(1),
});

export const storageRoutes = new Hono<{ Bindings: AppEnv }>();

async function hasValidBearerToken(c: { req: { header: (name: string) => string | undefined }; env: AppEnv }) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return false;
  }
  try {
    await verifyAccessToken(c.env, token);
    return true;
  } catch {
    return false;
  }
}

storageRoutes.post("/storage/upload", zValidator("json", uploadSchema), async (c) => {
  if (!(await hasValidBearerToken(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = c.req.valid("json");
  const raw = atob(body.dataBase64);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  const encodedKey = encodeURIComponent(body.key);

  await c.env.LMS_UPLOADS.put(body.key, bytes, {
    httpMetadata: { contentType: body.contentType },
  });

  return c.json({
    ok: true,
    key: body.key,
    url: new URL(`/storage/${encodedKey}`, c.req.url).toString(),
  });
});

storageRoutes.get("/storage/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.LMS_UPLOADS.get(key);

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
});
