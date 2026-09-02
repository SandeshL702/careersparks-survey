function installPath() {
  return `${process.cwd()}/data/install.json`;
}

export async function loadRuntimeEnv() {
  if (typeof window !== "undefined") return;
  const fs = await import("node:fs");
  const file = installPath();
  if (!fs.existsSync(file)) return;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* ignore corrupt install file */
  }
}

export async function saveInstallEnv(env: Record<string, string>) {
  if (typeof window !== "undefined") return;
  const fs = await import("node:fs");
  const file = installPath();
  fs.mkdirSync(`${process.cwd()}/data`, { recursive: true });
  let previous: Record<string, string> = {};
  if (fs.existsSync(file)) {
    try {
      previous = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
    } catch {
      previous = {};
    }
  }
  fs.writeFileSync(file, JSON.stringify({ ...previous, ...env }, null, 2));
  for (const [key, value] of Object.entries(env)) {
    if (value) process.env[key] = value;
  }
}
