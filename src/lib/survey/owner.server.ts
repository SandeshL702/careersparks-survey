/** Server-only workspace owner seed. Override on Hostinger with ADMIN_EMAIL / ADMIN_PASSWORD. */
function env(key: string) {
  return typeof process !== "undefined" ? process.env[key]?.trim() : "";
}

export const OWNER_LOGIN = {
  email: env("ADMIN_EMAIL") || "admin@careersparksco.in",
  password: env("ADMIN_PASSWORD") || "Spark@2026",
  name: env("ADMIN_NAME") || "CareerSparks Admin",
};
