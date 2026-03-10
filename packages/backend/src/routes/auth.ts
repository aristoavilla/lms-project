import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import type { AppEnv } from "../env";
import { users } from "../db/schema";
import { signAccessToken, verifyAccessToken } from "../lib/auth";

function toPublicUser(user: {
  id: string;
  externalId: string | null;
  email: string;
  name: string;
  role: string;
  approved: boolean;
  classId: string;
  subjectId: string | null;
  taughtClassIds: string[] | null;
  bio: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.externalId ?? user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    approved: user.approved,
    classId: user.classId,
    subjectId: user.subjectId ?? undefined,
    taughtClassIds: user.taughtClassIds ?? undefined,
    bio: user.bio ?? undefined,
    profileImageUrl: user.profileImageUrl ?? undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(1),
  classId: z.string().min(1).optional(),
});

const oauthSchema = z.object({
  email: z.email(),
});

export const authRoutes = new Hono<{ Bindings: AppEnv }>();

authRoutes.post("/auth/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const [created] = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      passwordHash: body.password,
      role: "regular_student",
      approved: false,
      classId: body.classId ?? "class-1A",
    })
    .returning({
      id: users.id,
      externalId: users.externalId,
      email: users.email,
      name: users.name,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    });

  return c.json({ user: toPublicUser(created) }, 201);
});

authRoutes.post("/auth/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env);

  const [user] = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      email: users.email,
      name: users.name,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.email, body.email), eq(users.passwordHash, body.password)))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signAccessToken(c.env, { sub: user.id, role: user.role });
  return c.json({ token, user: toPublicUser(user) });
});

authRoutes.post("/auth/oauth", zValidator("json", oauthSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env);

  const [user] = await db
    .select({
      id: users.id,
      externalId: users.externalId,
      email: users.email,
      name: users.name,
      role: users.role,
      approved: users.approved,
      classId: users.classId,
      subjectId: users.subjectId,
      taughtClassIds: users.taughtClassIds,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!user) {
    return c.json({ error: "No account found for this OAuth email" }, 404);
  }

  const token = await signAccessToken(c.env, { sub: user.id, role: user.role });
  return c.json({ token, user: toPublicUser(user) });
});

authRoutes.get("/auth/me", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = await verifyAccessToken(c.env, token);
    const userId = payload.sub;
    if (typeof userId !== "string") {
      return c.json({ error: "Invalid token payload" }, 401);
    }

    const db = getDb(c.env);
    const [user] = await db
      .select({
        id: users.id,
        externalId: users.externalId,
        email: users.email,
        name: users.name,
        role: users.role,
        approved: users.approved,
        classId: users.classId,
        subjectId: users.subjectId,
        taughtClassIds: users.taughtClassIds,
        bio: users.bio,
        profileImageUrl: users.profileImageUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user: toPublicUser(user) });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});
