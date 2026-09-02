import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import {
  isIgnorableMysqlError,
  mysqlConfigFromEnv,
  pgToMysql,
  splitSqlStatements,
} from "./sql-mysql";
import { pgPoolOptions, resolveDatabaseUrl } from "./pg-url";

export type DbSource = "neon" | "pglite" | "mysql";

/** PGLite only for Grok preview / local `npm run dev`. Never on Hostinger. */
export function allowEmbeddedDb(): boolean {
  if (typeof window !== "undefined") return false;
  if (mysqlConfigFromEnv() || resolveDatabaseUrl()) return false;
  if (process.env.GROK_AUTH_ISSUER) return true;
  return process.env.NODE_ENV === "development";
}

function detectDbSource(): DbSource {
  const mysql = mysqlConfigFromEnv();
  if (mysql) return "mysql";
  const url = resolveDatabaseUrl();
  if (url) return /^mysql(?:s)?:\/\//i.test(url) ? "mysql" : "neon";
  return "pglite";
}

export function getDbSource(): DbSource {
  return detectDbSource();
}

/** @deprecated use getDbSource() — kept so existing imports still compile */
export const dbSource: DbSource = detectDbSource();

const rawDatabaseUrl =
  typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl =
  rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl.trim() : undefined;

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __mysqlSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

function pgPoolOptionsLocal(url: string) {
  return pgPoolOptions(url);
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    try {
      const dns = await import("node:dns");
      dns.setDefaultResultOrder("ipv4first");
    } catch {
      /* ignore */
    }
    const url = resolveDatabaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set.");
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool(pgPoolOptionsLocal(url));
    await pool.query(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pool.query<{ name: string }>("select name from _migrations");
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(migrations[path] ?? "");
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
    }
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One in-memory instance per process, shared across HMR module instances, so
  // data survives source edits (it resets on dev-server restart).
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. The glob does not descend, so the opt-in
  // auth schema under migrations/auth/ stays out. Runs once per module instance
  // — so an HMR reload after adding a migration file applies it live — with
  // passes serialized on a global chain so concurrent callers never
  // double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

async function createMysqlSql(): Promise<Sql> {
  globalRef.__mysqlSqlPromise__ ??= (async () => {
    const mysql = await import("mysql2/promise");
    const cfg = mysqlConfigFromEnv();
    const pool =
      cfg && "uri" in cfg && cfg.uri
        ? mysql.createPool({ uri: cfg.uri, waitForConnections: true, connectionLimit: 8 })
        : mysql.createPool({
            host: cfg?.host,
            port: cfg?.port,
            user: cfg?.user,
            password: cfg?.password,
            database: cfg?.database,
            waitForConnections: true,
            connectionLimit: 8,
          });
    await pool.query(
      "create table if not exists _migrations (name varchar(191) primary key, applied_at datetime not null default current_timestamp)",
    );
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const [doneRows] = await pool.query("select name from _migrations");
    const done = (doneRows as Array<{ name: string }>).map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      const mysqlSql = pgToMysql(migrations[path] ?? "");
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const stmt of splitSqlStatements(mysqlSql)) {
          try {
            await conn.query(stmt);
          } catch (err) {
            if (!isIgnorableMysqlError(err)) throw err;
          }
        }
        await conn.query("insert into _migrations (name) values (?)", [name]);
        await conn.commit();
      } catch (err) {
        try {
          await conn.rollback();
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        conn.release();
      }
    }
    return toSql(async <T>(text: string, params: unknown[]) => {
      const [rows] = await pool.query(pgToMysql(text), params);
      return rows as T[];
    });
  })().catch((err) => {
    globalRef.__mysqlSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__mysqlSqlPromise__;
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  const source = getDbSource();
  if (source === "mysql") return createMysqlSql();
  if (source === "neon") return createNeonSql();
  if (!allowEmbeddedDb()) {
    throw new Error("Database not configured. Open /install to connect Hostinger MySQL.");
  }
  return createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
 * otherwise the local PGLite fallback. Memoized — safe to call per request.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= (async () => {
    if (typeof window === "undefined") {
      try {
        const env = await import("./runtime-env");
        await env.loadRuntimeEnv();
        const resolved = resolveDatabaseUrl();
        if (resolved && !process.env.DATABASE_URL) process.env.DATABASE_URL = resolved;
      } catch {
        /* no install file */
      }
    }
    return createSql();
  })().catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}

export function resetSqlCache() {
  sqlPromise = null;
  globalRef.__mysqlSqlPromise__ = undefined;
  globalRef.__pgSqlPromise__ = undefined;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (getDbSource() !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
 *   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
 * - **Neon**: no-op (pool is created lazily on first query).
 *
 * Vite `configureServer` awaits this at dev startup; production imports of this
 * module kick it off immediately (see bottom of file).
 */
export function ensureDbReady(): Promise<void> {
  if (getDbSource() !== "pglite" || !allowEmbeddedDb()) return Promise.resolve();
  return getSql().then(() => undefined);
}
