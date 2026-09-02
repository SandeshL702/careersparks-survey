/**
 * Postgres-shaped SQL → MySQL (Hostinger). Used only when DATABASE_URL is mysql://
 * or DB_HOST is set. Preview stays on PGLite; Neon stays on pg.
 */
export function isMysqlUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^mysql(?:s)?:\/\//i.test(url.trim());
}

export function mysqlConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = env.DATABASE_URL?.trim();
  if (url && isMysqlUrl(url)) return { uri: url };
  const host = env.DB_HOST?.trim();
  if (!host) return null;
  return {
    host,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || env.DB_USERNAME,
    password: env.DB_PASSWORD || env.DB_PASS,
    database: env.DB_NAME || env.DB_DATABASE,
  };
}

export function pgToMysql(sql: string): string {
  let s = sql;
  s = s.replace(
    /to_char\(\s*date_trunc\(\s*'day'\s*,\s*([^)]+)\)\s*,\s*'YYYY-MM-DD'\s*\)/gi,
    "date_format($1, '%Y-%m-%d')",
  );
  s = s.replace(/count\(\*\)::int/gi, "cast(count(*) as signed)");
  s = s.replace(/count\(([^)]+)\)::int/gi, "cast(count($1) as signed)");
  s = s.replace(/avg\(([^)]+)\)::int/gi, "cast(avg($1) as signed)");
  s = s.replace(/::int/gi, "");
  s = s.replace(/on conflict\s*\(([^)]+)\)\s*do nothing/gi, (_m, cols: string) => {
    const first = String(cols).split(",")[0]?.trim().replace(/[`"]/g, "") || "id";
    return `on duplicate key update ${first} = ${first}`;
  });
  s = s.replace(/timestamptz/gi, "datetime");
  s = s.replace(/\bboolean\b/gi, "tinyint(1)");
  s = s.replace(/default now\(\)/gi, "default current_timestamp");
  s = s.replace(/create index if not exists/gi, "create index");
  s = s.replace(/alter table\s+(\S+)\s+add column if not exists/gi, "alter table $1 add column");
  s = s.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "`$1`");
  s = s.replace(/\btext not null primary key/gi, "varchar(191) not null primary key");
  s = s.replace(/\btext not null unique/gi, "varchar(191) not null unique");
  s = s.replace(/\btext primary key/gi, "varchar(191) primary key");
  s = s.replace(/\btext\b/gi, "longtext");
  for (const col of [
    "id",
    "workspace_id",
    "user_id",
    "form_id",
    "created_by",
    "slug",
    "response_id",
    "token",
    "phone_digits",
    "stage",
    "email",
    "`id`",
    "`userId`",
    "`token`",
    "`email`",
  ]) {
    s = s.replace(new RegExp(`${col}\\s+longtext`, "gi"), `${col} varchar(191)`);
  }
  s = s.replace(/longtext not null default ''/gi, "longtext not null");
  s = s.replace(/longtext not null default '([^']*)'/gi, "varchar(64) not null default '$1'");
  s = s.replace(/\$(\d+)/g, "?");
  return s;
}

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
}

export function isIgnorableMysqlError(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  const errno = typeof err === "object" && err && "errno" in err ? Number((err as { errno?: number }).errno) : 0;
  return (
    code === "ER_DUP_KEYNAME" ||
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_TABLE_EXISTS_ERROR" ||
    errno === 1060 ||
    errno === 1061 ||
    errno === 1050
  );
}
