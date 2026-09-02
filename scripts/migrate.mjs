#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

const installFile = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "install.json");
if (existsSync(installFile)) {
  try {
    const saved = JSON.parse(readFileSync(installFile, "utf8"));
    for (const [key, value] of Object.entries(saved)) {
      if (typeof value === "string" && value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const dbHost = process.env.DB_HOST?.trim();
const isMysql = Boolean(
  (databaseUrl && /^mysql(?:s)?:\/\//i.test(databaseUrl)) || dbHost,
);

if (!databaseUrl && !dbHost) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  if (isMysql) {
    await migrateMysql(entries);
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

function pgToMysql(sql) {
  let s = sql;
  s = s.replace(
    /to_char\(\s*date_trunc\(\s*'day'\s*,\s*([^)]+)\)\s*,\s*'YYYY-MM-DD'\s*\)/gi,
    "date_format($1, '%Y-%m-%d')",
  );
  s = s.replace(/count\(\*\)::int/gi, "cast(count(*) as signed)");
  s = s.replace(/::int/gi, "");
  s = s.replace(/on conflict\s*\(([^)]+)\)\s*do nothing/gi, (_m, cols) => {
    const first = String(cols).split(",")[0].trim().replace(/[`"]/g, "") || "id";
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
  for (const col of ["id", "workspace_id", "user_id", "form_id", "created_by", "slug", "response_id", "token", "email", "`id`", "`userId`", "`token`", "`email`"]) {
    s = s.replace(new RegExp(`${col}\\s+longtext`, "gi"), `${col} varchar(191)`);
  }
  s = s.replace(/longtext not null default ''/gi, "longtext not null");
  s = s.replace(/longtext not null default '([^']*)'/gi, "varchar(64) not null default '$1'");
  s = s.replace(/\$(\d+)/g, "?");
  return s;
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
}

async function migrateMysql(entries) {
  const mysql = require("mysql2/promise");
  const pool = databaseUrl && /^mysql(?:s)?:\/\//i.test(databaseUrl)
    ? mysql.createPool({ uri: databaseUrl })
    : mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD || process.env.DB_PASS,
        database: process.env.DB_NAME || process.env.DB_DATABASE,
      });
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "create table if not exists _migrations (name varchar(191) primary key, applied_at datetime not null default current_timestamp)",
    );
    const [doneRows] = await conn.query("select name from _migrations");
    const applied = doneRows.map((r) => r.name);
    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      const mysqlSql = pgToMysql(text);
      await conn.beginTransaction();
      try {
        for (const stmt of splitSql(mysqlSql)) {
          try {
            await conn.query(stmt);
          } catch (err) {
            if (!["ER_DUP_KEYNAME", "ER_DUP_FIELDNAME", "ER_TABLE_EXISTS_ERROR"].includes(err.code)) {
              throw err;
            }
          }
        }
        await conn.query("insert into _migrations (name) values (?)", [name]);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      }
      console.log(`[migrate] applied ${name} (mysql)`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
