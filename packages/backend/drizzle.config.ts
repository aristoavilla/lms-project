import { defineConfig } from "drizzle-kit";
import { loadBackendEnv } from "./src/lib/nodeEnv";

loadBackendEnv();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
