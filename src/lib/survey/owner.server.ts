/** Server-only workspace owner. Set on /install or via ADMIN_* env. */
function env(key: string) {
  return typeof process !== "undefined" ? process.env[key]?.trim() : "";
}

export function getOwnerLogin() {
  return {
    email: env("ADMIN_EMAIL") || "admin@careersparksco.in",
    password: env("ADMIN_PASSWORD") || "Spark@2026",
    name: env("ADMIN_NAME") || "CareerSparks Admin",
  };
}

export const OWNER_LOGIN = {
  get email() {
    return getOwnerLogin().email;
  },
  get password() {
    return getOwnerLogin().password;
  },
  get name() {
    return getOwnerLogin().name;
  },
};
