/**
 * Hostinger Node.js Web App entry.
 * hPanel start command: `npm start`
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const installFile = join(process.cwd(), "data", "install.json");
if (existsSync(installFile)) {
  try {
    const data = JSON.parse(readFileSync(installFile, "utf8"));
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT || "3000";
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST || "0.0.0.0";
await import("../.output/server/index.mjs");
