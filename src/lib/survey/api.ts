import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { csvEscape, digitsPhone, nid, slugify } from "@/lib/utils";
import { parseFormCode, parseFormSchema, toCodeDocument } from "./schema";
import { answerToText, extractContact, sanitizeAnswers, scoreAnswers } from "./scoring";
import { WORKSPACE_ID } from "./seed";
import { JOB_REQUIREMENT_FORM, FORM_TEMPLATES } from "./templates";
import { emailError, phoneError, questionValueError } from "./validate";
import { OWNER_LOGIN } from "./owner.server";
import type {
  FormCategory,
  FormMode,
  FormRecord,
  FormSchema,
  FormStatus,
  Json,
  MemberRole,
  ResponseRecord,
  ResponseStage,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

type FormRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  schema_json: string;
  status: string;
  mode: string;
  created_at: string;
  updated_at: string;
  response_count?: number | string;
};

type MemberRow = {
  workspace_id: string;
  user_id: string;
  role: string;
  email: string | null;
};

function mapForm(row: FormRow): FormRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category as FormCategory,
    schema: parseFormSchema(JSON.parse(row.schema_json)),
    status: row.status as FormStatus,
    mode: row.mode as FormMode,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    responseCount: Number(row.response_count || 0),
  };
}

async function ensureOwnerAccount() {
  const sql = await getSql();
  const existing = await sql<{ n: number }>`select count(*)::int as n from "user" where email = ${OWNER_LOGIN.email}`;
  if ((existing[0]?.n ?? 0) > 0) return;
  try {
    const { auth } = await import("@/lib/auth/server");
    await auth.api.signUpEmail({
      body: {
        email: OWNER_LOGIN.email,
        password: OWNER_LOGIN.password,
        name: OWNER_LOGIN.name,
      },
    });
  } catch {
    // Account may already exist from a race, or auth tables not ready yet.
  }
}

async function ensureSeeded() {
  const sql = await getSql();
  await ensureOwnerAccount();
  await sql`insert into workspaces (id, name) values (${WORKSPACE_ID}, ${"CareerSparks"}) on conflict (id) do nothing`;
  try {
    await sql`alter table responses add column if not exists phone_digits text`;
  } catch {
    /* exists */
  }
  try {
    await sql`alter table responses add column if not exists stage text not null default 'new'`;
  } catch {
    /* exists */
  }

  const demoSlugs = [
    "community-pulse-are-you-looking",
    "walk-in-job-fair-registration",
    "interview-feedback",
    "client-hiring-request",
    "candidate-screening-quiz",
    "job-application-open-roles",
  ];
  for (const slug of demoSlugs) {
    const rows = await sql<{ id: string }>`select id from forms where slug = ${slug}`;
    for (const row of rows) {
      await sql`delete from form_events where form_id = ${row.id}`;
      await sql`delete from responses where form_id = ${row.id}`;
      await sql`delete from forms where id = ${row.id}`;
    }
  }

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
}

export const prepareWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  return { ok: true as const };
});

async function requireMember(userId: string) {
  const sql = await getSql();
  await ensureSeeded();
  await sql`insert into workspaces (id, name) values (${WORKSPACE_ID}, ${"CareerSparks"}) on conflict (id) do nothing`;
  const mine = await sql<MemberRow>`select workspace_id, user_id, role, email from workspace_members where user_id = ${userId} limit 1`;
  if (mine[0]) return { workspaceId: mine[0].workspace_id, role: mine[0].role as MemberRole };
  const users = await sql<{ email: string | null }>`select email from "user" where id = ${userId} limit 1`;
  const email = users[0]?.email?.toLowerCase() ?? "";
  if (email && email === OWNER_LOGIN.email.toLowerCase()) {
    await sql`insert into workspace_members (workspace_id, user_id, role, email) values (${WORKSPACE_ID}, ${userId}, ${"owner"}, ${users[0]?.email ?? null})
      on conflict (workspace_id, user_id) do nothing`;
    return { workspaceId: WORKSPACE_ID, role: "owner" as MemberRole };
  }
  throw new Error("Staff access only.");
}

async function requireEditor(userId: string) {
  const m = await requireMember(userId);
  if (m.role === "viewer") throw new Error("Viewers cannot edit forms.");
  return m;
}

async function requireOwner(userId: string) {
  const m = await requireMember(userId);
  if (m.role !== "owner") throw new Error("Only the workspace owner can do this.");
  return m;
}

async function findTakenContact(
  formId: string,
  email?: string | null,
  phone?: string | null,
  excludeId?: string,
) {
  const sql = await getSql();
  const mail = (email || "").trim().toLowerCase();
  if (mail.includes("@")) {
    const prior = await sql<{ id: string }>`select id from responses where form_id = ${formId} and respondent_email = ${mail} limit 1`;
    if (prior[0] && prior[0].id !== excludeId) return "This email already submitted this form.";
  }
  const digits = digitsPhone(phone);
  if (digits.length >= 10) {
    const prior = await sql<{ id: string }>`select id from responses where form_id = ${formId} and phone_digits = ${digits} limit 1`;
    if (prior[0] && prior[0].id !== excludeId) return "This WhatsApp number already submitted this form.";
    const priorRaw = await sql<{ id: string }>`select id from responses where form_id = ${formId} and respondent_phone = ${phone} limit 1`;
    if (priorRaw[0] && priorRaw[0].id !== excludeId) return "This WhatsApp number already submitted this form.";
  }
  return null;
}

function mapResponse(row: {
  id: string;
  form_id: string;
  answers_json: string;
  score: number | null;
  max_score: number | null;
  duration_ms: number | null;
  source: string;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  reviewed?: boolean;
  starred?: boolean;
  notes?: string;
  respondent_user_id?: string | null;
  stage?: string | null;
}): ResponseRecord {
  const stage = (row.stage || "new") as ResponseStage;
  return {
    id: row.id,
    formId: row.form_id,
    answers: JSON.parse(row.answers_json) as Record<string, Json>,
    score: row.score,
    maxScore: row.max_score,
    durationMs: row.duration_ms,
    source: row.source,
    respondentName: row.respondent_name,
    respondentEmail: row.respondent_email,
    respondentPhone: row.respondent_phone,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    reviewed: Boolean(row.reviewed),
    starred: Boolean(row.starred),
    notes: String(row.notes || ""),
    respondentUserId: row.respondent_user_id ?? null,
    stage: ["new", "contacted", "shortlisted", "rejected", "joined"].includes(stage) ? stage : "new",
  };
}

function publicForm(form: FormRecord) {
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    category: form.category,
    mode: form.mode,
    status: form.status,
    schema: form.schema,
    responseCount: form.responseCount,
  };
}

export const listPublishedForms = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<FormRow>`
    select f.*, (select count(*)::int from responses r where r.form_id = f.id) as response_count
    from forms f
    where f.status = ${"published"}
    order by f.updated_at desc
  `;
  return rows.map((row) => {
    const form = mapForm(row);
    return {
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      category: form.category,
      mode: form.mode,
      responseCount: form.responseCount,
    };
  });
});

export const getPublishedForm = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data, context }) => {
    await ensureSeeded();
    const sql = await getSql();
    const rows = await sql<FormRow>`
      select f.*, (select count(*)::int from responses r where r.form_id = f.id) as response_count
      from forms f where f.slug = ${data.slug} limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const form = mapForm(row);
    if (form.status === "draft") return null;
    return {
      ...publicForm(form),
      requireGoogle: false,
      alreadySubmitted: false,
      signedIn: Boolean(context.userId),
    };
  });

export const trackFormEvent = createServerFn({ method: "POST" })
  .validator(z.object({ formId: z.string(), kind: z.enum(["view", "start", "complete"]) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`insert into form_events (id, form_id, kind) values (${nid()}, ${data.formId}, ${data.kind})`;
    return { ok: true };
  });

export const submitResponse = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(
    z.object({
      slug: z.string(),
      answers: z.record(z.string(), z.any()),
      durationMs: z.number().optional(),
      source: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<FormRow>`select f.*, 0 as response_count from forms f where f.slug = ${data.slug} limit 1`;
    const row = rows[0];
    if (!row) throw new Error("Form not found.");
    const form = mapForm(row);
    if (form.status !== "published") throw new Error("This form is closed.");
    const contactEarly = extractContact(data.answers as Record<string, Json>, form.schema.questions);
    if (form.schema.settings.allowMultiple === false) {
      const taken = await findTakenContact(form.id, contactEarly.email, contactEarly.phone);
      if (taken) throw new Error(taken);
    }
    const cap = form.schema.settings.maxResponses;
    if (cap && cap > 0) {
      const counts = await sql<{ n: number }>`select count(*)::int as n from responses where form_id = ${form.id}`;
      if ((counts[0]?.n ?? 0) >= cap) {
        await sql`update forms set status = ${"closed"}, updated_at = now() where id = ${form.id}`;
        throw new Error("This form is full and no longer accepting responses.");
      }
    }
    const answers = sanitizeAnswers(form.schema, data.answers);
    for (const q of form.schema.questions) {
      if (q.type === "statement") continue;
      if (q.showIf) {
        const parent = answers[q.showIf.questionId];
        if (String(parent ?? "") !== q.showIf.equals) continue;
      }
      const err = questionValueError(q, answers[q.id]);
      if (err) throw new Error(`${q.title}: ${err}`);
    }
    const scored = scoreAnswers(form.schema, answers);
    const contact = extractContact(answers, form.schema.questions);
    const email = (contact.email || context.userEmail || "").toLowerCase() || null;
    const phone = contact.phone;
    const phoneDigits = digitsPhone(phone);
    const id = nid();
    const now = new Date().toISOString();
    await sql`insert into responses (id, form_id, answers_json, score, max_score, duration_ms, source, respondent_name, respondent_email, respondent_phone, started_at, completed_at, created_at, respondent_user_id, phone_digits, stage)
      values (${id}, ${form.id}, ${JSON.stringify(answers)}, ${scored.maxScore ? scored.score : null}, ${scored.maxScore || null}, ${data.durationMs ?? null}, ${data.source || "web"}, ${contact.name}, ${email}, ${phone}, ${now}, ${now}, ${now}, ${context.userId ?? null}, ${phoneDigits || null}, ${"new"})`;
    await sql`insert into form_events (id, form_id, kind) values (${nid()}, ${form.id}, ${"complete"})`;
    if (cap && cap > 0) {
      const after = await sql<{ n: number }>`select count(*)::int as n from responses where form_id = ${form.id}`;
      if ((after[0]?.n ?? 0) >= cap) {
        await sql`update forms set status = ${"closed"}, updated_at = now() where id = ${form.id}`;
      }
    }
    let emailed = false;
    try {
      const { queueFormEmails } = await import("./mail.server");
      const mail = await queueFormEmails({
        form,
        responseId: id,
        name: contact.name,
        email,
        phone: contact.phone,
        source: data.source || "web",
        score: scored.maxScore ? scored.score : null,
        maxScore: scored.maxScore || null,
      });
      emailed = mail.emailed;
    } catch {
      emailed = false;
    }
    return {
      id,
      score: scored.maxScore ? scored.score : null,
      maxScore: scored.maxScore || null,
      passPercent: form.schema.settings.passPercent,
      quizMode: form.schema.settings.quizMode,
      thankYou: form.schema.settings.thankYou,
      title: form.title,
      emailed: emailed && Boolean(email),
      email,
    };
  });

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const members = await sql<MemberRow>`
      select workspace_id, user_id, role, email from workspace_members
      where workspace_id = ${m.workspaceId} order by created_at asc
    `;
    return {
      workspaceId: m.workspaceId,
      role: m.role,
      members: members.map((row) => ({
        userId: row.user_id,
        role: row.role as MemberRole,
        email: row.email,
      })),
    };
  });

export const listForms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const rows = await sql<FormRow>`
      select f.*, (select count(*)::int from responses r where r.form_id = f.id) as response_count
      from forms f
      where f.workspace_id = ${m.workspaceId}
      order by f.updated_at desc
    `;
    return rows.map(mapForm);
  });

export const getForm = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const rows = await sql<FormRow>`
      select f.*, (select count(*)::int from responses r where r.form_id = f.id) as response_count
      from forms f where f.id = ${data.id} and f.workspace_id = ${m.workspaceId} limit 1
    `;
    if (!rows[0]) return null;
    return mapForm(rows[0]);
  });

export const createForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      mode: z.enum(["classic", "conversational"]).optional(),
      category: z.string().optional(),
      schema: z.any().optional(),
      code: z.string().optional(),
      publish: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    let title = data.title;
    let description = data.description ?? "";
    let mode: FormMode = data.mode ?? "classic";
    let category = (data.category || "pulse") as FormCategory;
    let schema: FormSchema;

    if (data.code) {
      const doc = parseFormCode(data.code);
      title = doc.title;
      description = doc.description;
      mode = doc.mode;
      category = doc.category;
      schema = { questions: doc.questions, settings: doc.settings };
    } else if (data.schema) {
      schema = parseFormSchema(data.schema);
    } else {
      schema = {
        questions: [{ id: "q_name", type: "short_text", title: "Full name", required: true }],
        settings: { ...DEFAULT_SETTINGS },
      };
    }

    const id = nid();
    const slug = slugify(title);
    const sql = await getSql();
    await sql`insert into forms (id, workspace_id, created_by, slug, title, description, category, schema_json, status, mode)
      values (${id}, ${m.workspaceId}, ${context.userId}, ${slug}, ${title}, ${description}, ${category}, ${JSON.stringify(schema)}, ${data.publish ? "published" : "draft"}, ${mode})`;
    return { id, slug };
  });

export const createFromTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ index: z.number() }))
  .handler(async ({ context, data }) => {
    const tpl = FORM_TEMPLATES[data.index];
    if (!tpl) throw new Error("Template not found.");
    const m = await requireEditor(context.userId);
    const id = nid();
    const slug = slugify(tpl.title);
    const schema: FormSchema = { questions: tpl.questions, settings: tpl.settings };
    const sql = await getSql();
    await sql`insert into forms (id, workspace_id, created_by, slug, title, description, category, schema_json, status, mode)
      values (${id}, ${m.workspaceId}, ${context.userId}, ${slug}, ${tpl.title}, ${tpl.description}, ${tpl.category}, ${JSON.stringify(schema)}, ${"draft"}, ${tpl.mode})`;
    return { id, slug };
  });

export const updateForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      mode: z.enum(["classic", "conversational"]).optional(),
      category: z.string().optional(),
      status: z.enum(["draft", "published", "closed"]).optional(),
      schema: z.any().optional(),
      code: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    const rows = await sql<FormRow>`select f.*, 0 as response_count from forms f where f.id = ${data.id} and f.workspace_id = ${m.workspaceId} limit 1`;
    if (!rows[0]) throw new Error("Form not found.");
    const current = mapForm(rows[0]);
    let title = data.title ?? current.title;
    let description = data.description ?? current.description;
    let mode = data.mode ?? current.mode;
    let category = (data.category ?? current.category) as FormCategory;
    let schema = current.schema;
    if (data.code) {
      const doc = parseFormCode(data.code);
      title = doc.title;
      description = doc.description;
      mode = doc.mode;
      category = doc.category;
      schema = { questions: doc.questions, settings: doc.settings };
    } else if (data.schema) {
      schema = parseFormSchema(data.schema);
    }
    const status = data.status ?? current.status;
    await sql`update forms set title = ${title}, description = ${description}, mode = ${mode}, category = ${category}, status = ${status}, schema_json = ${JSON.stringify(schema)}, updated_at = now()
      where id = ${data.id} and workspace_id = ${m.workspaceId}`;
    return { ok: true };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    await sql`delete from forms where id = ${data.id} and workspace_id = ${m.workspaceId}`;
    return { ok: true };
  });

export const duplicateForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    const rows = await sql<FormRow>`select f.*, 0 as response_count from forms f where f.id = ${data.id} and f.workspace_id = ${m.workspaceId} limit 1`;
    if (!rows[0]) throw new Error("Form not found.");
    const form = mapForm(rows[0]);
    const id = nid();
    const title = `${form.title} (copy)`;
    await sql`insert into forms (id, workspace_id, created_by, slug, title, description, category, schema_json, status, mode)
      values (${id}, ${m.workspaceId}, ${context.userId}, ${slugify(title)}, ${title}, ${form.description}, ${form.category}, ${JSON.stringify(form.schema)}, ${"draft"}, ${form.mode})`;
    return { id };
  });

export const listResponses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ formId: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`select id from forms where id = ${data.formId} and workspace_id = ${m.workspaceId}`;
    if (!owned[0]) throw new Error("Form not found.");
    const rows = await sql<Parameters<typeof mapResponse>[0]>`select * from responses where form_id = ${data.formId} order by created_at desc limit 500`;
    return rows.map(mapResponse);
  });

export const exportResponsesCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ formId: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const forms = await sql<FormRow>`
      select f.*, 0 as response_count from forms f
      where f.id = ${data.formId} and f.workspace_id = ${m.workspaceId} limit 1
    `;
    if (!forms[0]) throw new Error("Form not found.");
    const form = mapForm(forms[0]);
    const rows = await sql<{
      answers_json: string;
      score: number | null;
      max_score: number | null;
      duration_ms: number | null;
      source: string;
      respondent_name: string | null;
      respondent_email: string | null;
      respondent_phone: string | null;
      created_at: string;
    }>`select answers_json, score, max_score, duration_ms, source, respondent_name, respondent_email, respondent_phone, created_at
       from responses where form_id = ${data.formId} order by created_at desc limit 2000`;
    const questions = form.schema.questions.filter((q) => q.type !== "statement");
    const header = [
      "submitted_at",
      "name",
      "email",
      "phone",
      "source",
      "score",
      "max_score",
      "duration_ms",
      ...questions.map((q) => q.title),
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of rows) {
      const answers = JSON.parse(r.answers_json) as Record<string, Json>;
      lines.push(
        [
          r.created_at,
          r.respondent_name,
          r.respondent_email,
          r.respondent_phone,
          r.source,
          r.score,
          r.max_score,
          r.duration_ms,
          ...questions.map((q) => answerToText(answers[q.id])),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    return { filename: `${form.slug}-responses.csv`, csv: lines.join("\n") };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const totals = await sql<{
      forms: number;
      published: number;
      responses: number;
      views: number;
    }>`
      select
        (select count(*)::int from forms where workspace_id = ${m.workspaceId}) as forms,
        (select count(*)::int from forms where workspace_id = ${m.workspaceId} and status = ${"published"}) as published,
        (select count(*)::int from responses r join forms f on f.id = r.form_id where f.workspace_id = ${m.workspaceId}) as responses,
        (select count(*)::int from form_events e join forms f on f.id = e.form_id where f.workspace_id = ${m.workspaceId} and e.kind = ${"view"}) as views
    `;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const daily = await sql<{ day: string; n: number }>`
      select to_char(date_trunc('day', r.created_at), 'YYYY-MM-DD') as day, count(*)::int as n
      from responses r
      join forms f on f.id = r.form_id
      where f.workspace_id = ${m.workspaceId} and r.created_at > ${since}
      group by 1 order by 1
    `;
    const sources = await sql<{ source: string; n: number }>`
      select r.source, count(*)::int as n
      from responses r
      join forms f on f.id = r.form_id
      where f.workspace_id = ${m.workspaceId}
      group by 1
    `;
    const top = await sql<{ id: string; title: string; slug: string; n: number }>`
      select f.id, f.title, f.slug, count(r.id)::int as n
      from forms f
      left join responses r on r.form_id = f.id
      where f.workspace_id = ${m.workspaceId}
      group by f.id, f.title, f.slug
      order by n desc
      limit 6
    `;
    const t = totals[0] || { forms: 0, published: 0, responses: 0, views: 0 };
    const completion = t.views > 0 ? Math.round((t.responses / t.views) * 1000) / 10 : 0;
    return {
      forms: t.forms,
      published: t.published,
      responses: t.responses,
      views: t.views,
      completion,
      daily: daily.map((d) => ({ day: d.day, n: Number(d.n) })),
      sources: sources.map((s) => ({ source: s.source, n: Number(s.n) })),
      top: top.map((row) => ({ id: row.id, title: row.title, slug: row.slug, n: Number(row.n) })),
      role: m.role,
    };
  });

export const getFormAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ formId: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const forms = await sql<FormRow>`select f.*, 0 as response_count from forms f where f.id = ${data.formId} and f.workspace_id = ${m.workspaceId} limit 1`;
    if (!forms[0]) throw new Error("Form not found.");
    const form = mapForm(forms[0]);
    const counts = await sql<{ views: number; starts: number; completes: number; avg_ms: number | null; avg_score: number | null }>`
      select
        (select count(*)::int from form_events where form_id = ${data.formId} and kind = ${"view"}) as views,
        (select count(*)::int from form_events where form_id = ${data.formId} and kind = ${"start"}) as starts,
        (select count(*)::int from responses where form_id = ${data.formId}) as completes,
        (select avg(duration_ms)::int from responses where form_id = ${data.formId}) as avg_ms,
        (select avg(score) from responses where form_id = ${data.formId} and score is not null) as avg_score
    `;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const daily = await sql<{ day: string; n: number }>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n
      from responses where form_id = ${data.formId} and created_at > ${since}
      group by 1 order by 1
    `;
    const sources = await sql<{ source: string; n: number }>`
      select source, count(*)::int as n from responses where form_id = ${data.formId} group by 1
    `;
    const scoreBuckets = await sql<{ bucket: string; n: number }>`
      select
        case
          when score is null then 'n/a'
          when max_score is null or max_score = 0 then 'n/a'
          when (score::float / max_score) >= 0.8 then '80-100%'
          when (score::float / max_score) >= 0.6 then '60-79%'
          when (score::float / max_score) >= 0.4 then '40-59%'
          else '0-39%'
        end as bucket,
        count(*)::int as n
      from responses where form_id = ${data.formId}
      group by 1
    `;
    const responseRows = await sql<{
      answers_json: string;
      duration_ms: number | null;
      score: number | null;
      created_at: string;
      respondent_email: string | null;
      respondent_user_id: string | null;
    }>`select answers_json, duration_ms, score, created_at, respondent_email, respondent_user_id from responses where form_id = ${data.formId}`;
    const completes = responseRows.length || Number(counts[0]?.completes || 0);
    const breakdown: Array<{
      id: string;
      title: string;
      type: string;
      answers: number;
      skipRate: number;
      average: number | null;
      options: Array<{ label: string; n: number }>;
    }> = [];
    for (const q of form.schema.questions) {
      if (q.type === "statement" || q.type === "file") continue;
      const tally = new Map<string, number>();
      let answered = 0;
      let numericSum = 0;
      let numericN = 0;
      for (const row of responseRows) {
        const answers = JSON.parse(row.answers_json) as Record<string, Json>;
        const v = answers[q.id];
        if (v == null || v === "") continue;
        answered += 1;
        if (typeof v === "number") {
          numericSum += v;
          numericN += 1;
        }
        if (q.type === "long_text" || q.type === "short_text" || q.type === "email" || q.type === "phone") continue;
        const vals = Array.isArray(v) ? v.map(String) : [String(v)];
        for (const val of vals) tally.set(val, (tally.get(val) || 0) + 1);
      }
      breakdown.push({
        id: q.id,
        title: q.title,
        type: q.type,
        answers: answered,
        skipRate: completes ? Math.round((1 - answered / completes) * 1000) / 10 : 0,
        average: numericN ? Math.round((numericSum / numericN) * 10) / 10 : null,
        options: [...tally.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([label, n]) => ({ label, n })),
      });
    }
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0 }));
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => ({ day: d, n: 0 }));
    const durationBuckets = [
      { bucket: "< 1 min", n: 0 },
      { bucket: "1–3 min", n: 0 },
      { bucket: "3–8 min", n: 0 },
      { bucket: "8+ min", n: 0 },
    ];
    const unique = new Set<string>();
    for (const row of responseRows) {
      const dt = new Date(row.created_at);
      if (!Number.isNaN(dt.getTime())) {
        hours[dt.getHours()]!.n += 1;
        weekdays[dt.getDay()]!.n += 1;
      }
      const ms = row.duration_ms ?? 0;
      if (ms < 60_000) durationBuckets[0]!.n += 1;
      else if (ms < 180_000) durationBuckets[1]!.n += 1;
      else if (ms < 480_000) durationBuckets[2]!.n += 1;
      else durationBuckets[3]!.n += 1;
      if (row.respondent_email) unique.add(row.respondent_email.toLowerCase());
      else if (row.respondent_user_id) unique.add(row.respondent_user_id);
    }
    const weakest = [...breakdown].sort((a, b) => b.skipRate - a.skipRate)[0] ?? null;
    const c = counts[0] || { views: 0, starts: 0, completes: 0, avg_ms: null, avg_score: null };
    const dropOffStart = Number(c.views) ? Math.round((1 - Number(c.starts) / Number(c.views)) * 1000) / 10 : 0;
    const dropOffSubmit = Number(c.starts) ? Math.round((1 - Number(c.completes) / Number(c.starts)) * 1000) / 10 : 0;
    return {
      form: { id: form.id, title: form.title, slug: form.slug, quizMode: form.schema.settings.quizMode },
      views: Number(c.views),
      starts: Number(c.starts),
      completes: Number(c.completes),
      completion: c.views ? Math.round((Number(c.completes) / Number(c.views)) * 1000) / 10 : 0,
      avgDurationMs: c.avg_ms,
      avgScore: c.avg_score == null ? null : Number(c.avg_score),
      uniqueRespondents: unique.size,
      dropOffStart,
      dropOffSubmit,
      weakestQuestion: weakest ? { title: weakest.title, skipRate: weakest.skipRate } : null,
      daily: daily.map((d) => ({ day: d.day, n: Number(d.n) })),
      hours,
      weekdays,
      durationBuckets,
      sources: sources.map((s) => ({ source: s.source, n: Number(s.n) })),
      scoreBuckets: scoreBuckets.map((b) => ({ bucket: b.bucket, n: Number(b.n) })),
      breakdown,
    };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string(), role: z.enum(["owner", "recruiter", "viewer"]) }))
  .handler(async ({ context, data }) => {
    const m = await requireOwner(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own role.");
    const sql = await getSql();
    await sql`update workspace_members set role = ${data.role} where workspace_id = ${m.workspaceId} and user_id = ${data.userId}`;
    return { ok: true };
  });

export const listTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return FORM_TEMPLATES.map((t, index) => ({
    index,
    title: t.title,
    description: t.description,
    category: t.category,
    mode: t.mode,
    questions: t.questions.length,
  }));
});

export function formToCode(form: FormRecord): string {
  return JSON.stringify(toCodeDocument(form), null, 2);
}

export const getMailSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMember(context.userId);
    const { loadMailSettings } = await import("./mail.server");
    const s = await loadMailSettings();
    return { ...s, smtpPass: (s.smtpPass ? "••••••••" : "") as string };
  });

export const saveMailSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      smtpHost: z.string(),
      smtpPort: z.number(),
      smtpUser: z.string(),
      smtpPass: z.string().optional(),
      smtpFrom: z.string(),
      notifyEmail: z.string(),
      thankYouSubject: z.string(),
      thankYouBody: z.string(),
      notifySubject: z.string(),
      notifyBody: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    await sql`insert into workspace_settings (workspace_id) values (${WORKSPACE_ID}) on conflict (workspace_id) do nothing`;
    const keepPass = !data.smtpPass || data.smtpPass.includes("•");
    if (keepPass) {
      await sql`update workspace_settings set
        smtp_host = ${data.smtpHost},
        smtp_port = ${data.smtpPort},
        smtp_user = ${data.smtpUser},
        smtp_from = ${data.smtpFrom},
        notify_email = ${data.notifyEmail},
        thank_you_subject = ${data.thankYouSubject},
        thank_you_body = ${data.thankYouBody},
        notify_subject = ${data.notifySubject},
        notify_body = ${data.notifyBody},
        updated_at = now()
        where workspace_id = ${WORKSPACE_ID}`;
    } else {
      await sql`update workspace_settings set
        smtp_host = ${data.smtpHost},
        smtp_port = ${data.smtpPort},
        smtp_user = ${data.smtpUser},
        smtp_pass = ${data.smtpPass},
        smtp_from = ${data.smtpFrom},
        notify_email = ${data.notifyEmail},
        thank_you_subject = ${data.thankYouSubject},
        thank_you_body = ${data.thankYouBody},
        notify_subject = ${data.notifySubject},
        notify_body = ${data.notifyBody},
        updated_at = now()
        where workspace_id = ${WORKSPACE_ID}`;
    }
    return { ok: true };
  });

export const sendTestMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ to: z.string() }))
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const { sendTestEmail } = await import("./mail.server");
    return sendTestEmail(data.to);
  });

export const listOutbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMember(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      kind: string;
      to_email: string;
      subject: string;
      status: string;
      error: string | null;
      created_at: string;
      sent_at: string | null;
    }>`select id, kind, to_email, subject, status, error, created_at, sent_at from email_outbox
      where workspace_id = ${WORKSPACE_ID} order by created_at desc limit 80`;
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      to: r.to_email,
      subject: r.subject,
      status: r.status,
      error: r.error,
      createdAt: String(r.created_at),
      sentAt: r.sent_at ? String(r.sent_at) : null,
    }));
  });

export const setResponseReviewed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), reviewed: z.boolean() }))
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    await sql`update responses set reviewed = ${data.reviewed}
      where id = ${data.id}
      and form_id in (select id from forms where workspace_id = ${m.workspaceId})`;
    return { ok: true };
  });

export const setResponseFlags = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      starred: z.boolean().optional(),
      notes: z.string().optional(),
      reviewed: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select r.id from responses r
      join forms f on f.id = r.form_id
      where r.id = ${data.id} and f.workspace_id = ${m.workspaceId}
      limit 1
    `;
    if (!owned[0]) throw new Error("Response not found.");
    if (data.starred != null) await sql`update responses set starred = ${data.starred} where id = ${data.id}`;
    if (data.notes != null) await sql`update responses set notes = ${data.notes} where id = ${data.id}`;
    if (data.reviewed != null) await sql`update responses set reviewed = ${data.reviewed} where id = ${data.id}`;
    return { ok: true };
  });

export const listInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      form_id: string;
      title: string;
      slug: string;
      respondent_name: string | null;
      respondent_email: string | null;
      respondent_phone: string | null;
      score: number | null;
      max_score: number | null;
      source: string;
      starred: boolean;
      reviewed: boolean;
      stage: string | null;
      notes: string | null;
      created_at: string;
    }>`
      select r.id, r.form_id, f.title, f.slug, r.respondent_name, r.respondent_email, r.respondent_phone,
        r.score, r.max_score, r.source, r.starred, r.reviewed, r.stage, r.notes, r.created_at
      from responses r
      join forms f on f.id = r.form_id
      where f.workspace_id = ${m.workspaceId}
      order by r.starred desc, r.created_at desc
      limit 200
    `;
    return rows.map((r) => ({
      id: r.id,
      formId: r.form_id,
      formTitle: r.title,
      slug: r.slug,
      name: r.respondent_name,
      email: r.respondent_email,
      phone: r.respondent_phone,
      score: r.score,
      maxScore: r.max_score,
      source: r.source,
      starred: Boolean(r.starred),
      reviewed: Boolean(r.reviewed),
      stage: (r.stage || "new") as ResponseStage,
      notes: r.notes || "",
      createdAt: String(r.created_at),
    }));
  });

export const checkContactTaken = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`select id from forms where slug = ${data.slug} and status = ${"published"} limit 1`;
    if (!rows[0]) return { taken: false as const, message: "" };
    const message = await findTakenContact(rows[0].id, data.email, data.phone);
    return { taken: Boolean(message), message: message || "" };
  });

export const deleteResponse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    await sql`delete from responses where id = ${data.id} and form_id in (select id from forms where workspace_id = ${m.workspaceId})`;
    return { ok: true };
  });

export const deleteResponses = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    for (const id of data.ids) {
      await sql`delete from responses where id = ${id} and form_id in (select id from forms where workspace_id = ${m.workspaceId})`;
    }
    return { ok: true, n: data.ids.length };
  });

export const updateResponse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      answers: z.record(z.string(), z.any()).optional(),
      respondentName: z.string().optional(),
      respondentEmail: z.string().optional(),
      respondentPhone: z.string().optional(),
      notes: z.string().optional(),
      starred: z.boolean().optional(),
      reviewed: z.boolean().optional(),
      stage: z.enum(["new", "contacted", "shortlisted", "rejected", "joined"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      form_id: string;
      answers_json: string;
      schema_json: string;
    }>`
      select r.id, r.form_id, r.answers_json, f.schema_json
      from responses r
      join forms f on f.id = r.form_id
      where r.id = ${data.id} and f.workspace_id = ${m.workspaceId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Response not found.");
    const schema = parseFormSchema(JSON.parse(row.schema_json));
    const answers = data.answers
      ? sanitizeAnswers(schema, data.answers as Record<string, Json>)
      : (JSON.parse(row.answers_json) as Record<string, Json>);
    const scored = scoreAnswers(schema, answers);
    const contact = extractContact(answers, schema.questions);
    const name = data.respondentName ?? contact.name;
    const email = (data.respondentEmail ?? contact.email ?? "").toLowerCase() || null;
    const phone = data.respondentPhone ?? contact.phone;
    const taken = await findTakenContact(row.form_id, email, phone, data.id);
    if (taken) throw new Error(taken);
    if (data.answers) {
      await sql`update responses set answers_json = ${JSON.stringify(answers)}, score = ${scored.maxScore ? scored.score : null}, max_score = ${scored.maxScore || null} where id = ${data.id}`;
    }
    await sql`update responses set respondent_name = ${name}, respondent_email = ${email}, respondent_phone = ${phone}, phone_digits = ${digitsPhone(phone) || null} where id = ${data.id}`;
    if (data.notes != null) await sql`update responses set notes = ${data.notes} where id = ${data.id}`;
    if (data.starred != null) await sql`update responses set starred = ${data.starred} where id = ${data.id}`;
    if (data.reviewed != null) await sql`update responses set reviewed = ${data.reviewed} where id = ${data.id}`;
    if (data.stage != null) await sql`update responses set stage = ${data.stage} where id = ${data.id}`;
    return { ok: true };
  });

export const addManualResponse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      formId: z.string(),
      respondentName: z.string().min(1),
      respondentPhone: z.string().min(10),
      respondentEmail: z.string().optional(),
      notes: z.string().optional(),
      answers: z.record(z.string(), z.any()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const m = await requireEditor(context.userId);
    const sql = await getSql();
    const forms = await sql<FormRow>`select f.*, 0 as response_count from forms f where f.id = ${data.formId} and f.workspace_id = ${m.workspaceId} limit 1`;
    if (!forms[0]) throw new Error("Form not found.");
    const form = mapForm(forms[0]);
    const phoneErr = phoneError(data.respondentPhone);
    if (phoneErr) throw new Error(phoneErr);
    if (data.respondentEmail) {
      const mailErr = emailError(data.respondentEmail);
      if (mailErr) throw new Error(mailErr);
    }
    const answers = sanitizeAnswers(form.schema, (data.answers || {}) as Record<string, Json>);
    const taken = await findTakenContact(form.id, data.respondentEmail, data.respondentPhone);
    if (taken) throw new Error(taken);
    const id = nid();
    const now = new Date().toISOString();
    const email = (data.respondentEmail || "").toLowerCase() || null;
    await sql`insert into responses (id, form_id, answers_json, score, max_score, duration_ms, source, respondent_name, respondent_email, respondent_phone, started_at, completed_at, created_at, phone_digits, stage, notes)
      values (${id}, ${form.id}, ${JSON.stringify(answers)}, ${null}, ${null}, ${null}, ${"manual"}, ${data.respondentName}, ${email}, ${data.respondentPhone}, ${now}, ${now}, ${now}, ${digitsPhone(data.respondentPhone)}, ${"new"}, ${data.notes || ""})`;
    return { id };
  });

