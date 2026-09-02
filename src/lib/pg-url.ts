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
    if (/^(postgres(ql)?|mysql):\/\//i.test(value)) return value;
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
  const needsSsl = /supabase\.co|neon\.tech|pooler\.supabase|sslmode=require/i.test(url);
  return {
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 8000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}
