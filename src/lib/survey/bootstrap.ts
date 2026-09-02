import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { parseFormSchema } from "./schema";
import { WORKSPACE_ID } from "./seed";
import { JOB_REQUIREMENT_FORM } from "./templates";

export async function bootstrapCareerSparks(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name?.trim() || "CareerSparks Admin";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const sql = await getSql();
  const owners = await sql<{ n: number }>`select count(*)::int as n from workspace_members where role = ${"owner"}`;
  if ((owners[0]?.n ?? 0) > 0) {
    throw new Error("Already installed. Open /login.");
  }

  let user = (await sql<{ id: string }>`select id from "user" where email = ${email} limit 1`)[0];
  if (!user) {
    const userId = nid();
    const hash = await hashPassword(password);
    await sql`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${name}, ${email}, ${true}, now(), now())`;
    await sql`insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${nid()}, ${userId}, ${"credential"}, ${userId}, ${hash}, now(), now())`;
    user = { id: userId };
  }

  await sql`insert into workspaces (id, name) values (${WORKSPACE_ID}, ${"CareerSparks"}) on conflict (id) do nothing`;
  await sql`insert into workspace_members (workspace_id, user_id, role, email)
    values (${WORKSPACE_ID}, ${user.id}, ${"owner"}, ${email})
    on conflict (workspace_id, user_id) do nothing`;

  const job = JOB_REQUIREMENT_FORM;
  const slug = "job-requirement";
  const schemaJson = JSON.stringify(parseFormSchema({ questions: job.questions, settings: job.settings }));
  const existing = await sql<{ id: string }>`select id from forms where slug = ${slug} limit 1`;
  if (existing[0]) {
    await sql`update forms set title = ${job.title}, description = ${job.description}, category = ${job.category}, schema_json = ${schemaJson}, status = ${"published"}, mode = ${job.mode}, updated_at = now() where id = ${existing[0].id}`;
  } else {
    await sql`insert into forms (id, workspace_id, created_by, slug, title, description, category, schema_json, status, mode)
      values (${"frm_job_requirement"}, ${WORKSPACE_ID}, ${"system"}, ${slug}, ${job.title}, ${job.description}, ${job.category}, ${schemaJson}, ${"published"}, ${job.mode})`;
  }

  return { ok: true as const, email };
}
