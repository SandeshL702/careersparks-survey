function supabaseProjectRef(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromSupabaseUrl = env.SUPABASE_URL?.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (fromSupabaseUrl) return fromSupabaseUrl;
  return undefined;
}

function splitPgUrl(raw: string) {
  const url = raw.trim().replace(/^["']|["']$/g, "");
  const match = url.match(/^(postgres(?:ql)?:\/\/)(.+)$/i);
  if (!match) return null;
  const rest = match[2];
  const at = rest.lastIndexOf("@");
  if (at < 0) return null;
  const userinfo = rest.slice(0, at);
  const hostAndPath = rest.slice(at + 1);
  const colon = userinfo.indexOf(":");
  const user = colon < 0 ? userinfo : userinfo.slice(0, colon);
  let password = colon < 0 ? "" : userinfo.slice(colon + 1);
  try {
    password = decodeURIComponent(password);
  } catch {
    /* keep raw */
  }
  let decodedUser = user;
  try {
    decodedUser = decodeURIComponent(user);
  } catch {
    /* keep raw */
  }
  return { scheme: match[1], user: decodedUser, password, hostAndPath };
}

function joinPgUrl(parts: { scheme: string; user: string; password: string; hostAndPath: string }) {
  return `${parts.scheme}${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}@${parts.hostAndPath}`;
}

/** Encode `@ # / %` in the password and fix Supabase pooler usernames. */
export function encodeDatabaseUrl(raw: string, env: NodeJS.ProcessEnv = process.env): string {
  const parts = splitPgUrl(raw);
  if (!parts) return raw.trim().replace(/^["']|["']$/g, "");

  const host = parts.hostAndPath.split("/")[0]?.split(":")[0] || "";
  const ref = supabaseProjectRef(env);
  const overridePassword = env.DATABASE_PASSWORD?.trim() || env.SUPABASE_DB_PASSWORD?.trim();
  if (overridePassword) parts.password = overridePassword;

  if (ref && /pooler\.supabase\.com$/i.test(host) && (parts.user === "postgres" || !parts.user.includes("."))) {
    parts.user = `postgres.${ref}`;
  }

  return joinPgUrl(parts);
}

export function describeDatabaseUrl(raw?: string) {
  if (!raw) return { user: null, host: null };
  const parts = splitPgUrl(encodeDatabaseUrl(raw));
  const host = parts?.hostAndPath.split("/")[0] || null;
  return { user: parts?.user ?? null, host };
}

/** Hostinger + Supabase inject different env names. Normalize to one URL. */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const keys = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "DIRECT_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of keys) {
    const value = env[key]?.trim();
    if (!value) continue;
    if (/^(postgres(ql)?|mysql):\/\//i.test(value)) {
      return /^mysql/i.test(value) ? value : encodeDatabaseUrl(value, env);
    }
  }

  const host = env.POSTGRES_HOST?.trim() || env.SUPABASE_DB_HOST?.trim();
  if (!host) return undefined;
  const ref = supabaseProjectRef(env);
  const user =
    env.POSTGRES_USER ||
    env.POSTGRES_USERNAME ||
    (ref && /pooler\.supabase/.test(host) ? `postgres.${ref}` : "postgres");
  const password = env.DATABASE_PASSWORD || env.POSTGRES_PASSWORD || env.SUPABASE_DB_PASSWORD || "";
  const database = env.POSTGRES_DATABASE || env.POSTGRES_DB || "postgres";
  const port = env.POSTGRES_PORT || "5432";
  return encodeDatabaseUrl(`postgresql://${user}:${password}@${host}:${port}/${database}`, env);
}

export function pgPoolOptions(url: string) {
  const encoded = encodeDatabaseUrl(url);
  const needsSsl = /supabase\.co|neon\.tech|pooler\.supabase|sslmode=require/i.test(encoded);
  return {
    connectionString: encoded,
    max: 5,
    connectionTimeoutMillis: 8000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}
