import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDbSource, getSql, resetSqlCache } from "@/lib/db";
import { loadRuntimeEnv, saveInstallEnv } from "@/lib/runtime-env";
import { getOwnerLogin } from "./owner.server";
import { ensureSeeded } from "./api";

export type InstallState =
  | { status: "ready" }
  | { status: "needs_admin"; dbHost: string; dbName: string }
  | {
      status: "needs_install";
      dbHost: string;
      dbPort: string;
      dbUser: string;
      dbName: string;
    };

async function readInstallState(): Promise<InstallState> {
  loadRuntimeEnv();
  if (getDbSource() === "pglite") return { status: "ready" };
  try {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from workspace_members`;
    if ((rows[0]?.n ?? 0) > 0) return { status: "ready" };
    return {
      status: "needs_admin",
      dbHost: process.env.DB_HOST || "localhost",
      dbName: process.env.DB_NAME || "",
    };
  } catch {
    return {
      status: "needs_install",
      dbHost: process.env.DB_HOST || "localhost",
      dbPort: process.env.DB_PORT || "3306",
      dbUser: process.env.DB_USER || process.env.DB_USERNAME || "",
      dbName: process.env.DB_NAME || process.env.DB_DATABASE || "",
    };
  }
}

export const getInstallState = createServerFn({ method: "GET" }).handler(async () => readInstallState());

export const runInstall = createServerFn({ method: "POST" })
  .validator(
    z.object({
      dbHost: z.string().min(1),
      dbPort: z.string().optional(),
      dbUser: z.string().min(1),
      dbPassword: z.string().min(1),
      dbName: z.string().min(1),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
      adminName: z.string().optional(),
      siteUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const current = await readInstallState();
    if (current.status === "ready") throw new Error("Already installed.");

    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      host: data.dbHost,
      port: Number(data.dbPort || 3306),
      user: data.dbUser,
      password: data.dbPassword,
      database: data.dbName,
    });
    try {
      await conn.query("select 1");
    } finally {
      await conn.end();
    }

    const secret = process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("hex");
    saveInstallEnv({
      DB_HOST: data.dbHost,
      DB_PORT: data.dbPort || "3306",
      DB_USER: data.dbUser,
      DB_PASSWORD: data.dbPassword,
      DB_NAME: data.dbName,
      ADMIN_EMAIL: data.adminEmail.trim().toLowerCase(),
      ADMIN_PASSWORD: data.adminPassword,
      ADMIN_NAME: data.adminName?.trim() || "CareerSparks Admin",
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: data.siteUrl?.trim() || process.env.BETTER_AUTH_URL || "",
      VITE_AUTH_ENABLED: "true",
    });
    resetSqlCache();
    if (getDbSource() !== "mysql") {
      throw new Error("Database saved, but MySQL is still not active. Restart the Node.js app in hPanel once.");
    }
    await getSql();
    await ensureSeeded();
    const owner = getOwnerLogin();
    return { ok: true as const, email: owner.email };
  });
