/** Encode `@ # / %` inside the password so URL parsers don't split the host. */
export function encodeDatabaseUrl(raw: string): string {
  const url = raw.trim().replace(/^["']|["']$/g, "");
  const match = url.match(/^(postgres(?:ql)?:\/\/)(.+)$/i);
  if (!match) return url;
  const rest = match[2];
  const at = rest.lastIndexOf("@");
  if (at < 0) return url;
  const userinfo = rest.slice(0, at);
  const hostAndPath = rest.slice(at + 1);
  const colon = userinfo.indexOf(":");
  if (colon < 0) return `${match[1]}${userinfo}@${hostAndPath}`;
  const user = userinfo.slice(0, colon);
  let password = userinfo.slice(colon + 1);
  try {
    password = decodeURIComponent(password);
  } catch {
    /* already raw */
  }
  return `${match[1]}${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostAndPath}`;
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
      return /^mysql/i.test(value) ? value : encodeDatabaseUrl(value);
    }
  }

  const host = env.POSTGRES_HOST?.trim() || env.SUPABASE_DB_HOST?.trim();
  if (!host) return undefined;
  const user = env.POSTGRES_USER || env.POSTGRES_USERNAME || "postgres";
  const password = env.POSTGRES_PASSWORD || env.SUPABASE_DB_PASSWORD || "";
  const database = env.POSTGRES_DATABASE || env.POSTGRES_DB || "postgres";
  const port = env.POSTGRES_PORT || "5432";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
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
