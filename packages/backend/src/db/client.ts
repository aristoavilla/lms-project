import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { AppEnv } from "../env";

export function getDb(env: AppEnv) {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql);
}
