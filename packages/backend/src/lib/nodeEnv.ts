import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  const commentIndex = value.indexOf(" #");
  if (commentIndex >= 0) {
    value = value.slice(0, commentIndex).trim();
  }

  if (!key) {
    return null;
  }

  return { key, value };
}

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
  } catch {
    // Missing env file is allowed.
  }
}

export function loadBackendEnv() {
  const cwd = process.cwd();
  loadEnvFile(resolve(cwd, ".dev.vars"));
  loadEnvFile(resolve(cwd, ".env.local"));
}
