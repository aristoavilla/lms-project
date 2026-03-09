import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("Set VITE_CONVEX_URL (or CONVEX_URL) before running import.");
}

const inputPath = resolve(process.cwd(), "seed", "convex-seed.json");
const seed = JSON.parse(readFileSync(inputPath, "utf8"));

const client = new ConvexHttpClient(convexUrl);
const result = await client.mutation("client:importSeedJson", {
  seed,
  reset: true,
});

console.log("Import complete:");
console.log(JSON.stringify(result, null, 2));
