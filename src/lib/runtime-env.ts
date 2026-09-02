import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "data", "install.json");

export function loadRuntimeEnv() {
  if (typeof window !== "undefined") return;
  if (!existsSync(FILE)) return;
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* ignore corrupt install file */
  }
}

export function saveInstallEnv(env: Record<string, string>) {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  let previous: Record<string, string> = {};
  if (existsSync(FILE)) {
    try {
      previous = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
    } catch {
      previous = {};
    }
  }
  const merged = { ...previous, ...env };
  writeFileSync(FILE, JSON.stringify(merged, null, 2));
  for (const [key, value] of Object.entries(env)) {
    if (value) process.env[key] = value;
  }
}

export function hasInstallFile() {
  return existsSync(FILE);
}

loadRuntimeEnv();
