import net from "node:net";
import tls from "node:tls";
import { nid } from "@/lib/utils";
import { getSql } from "@/lib/db";
import { WORKSPACE_ID } from "./seed";
import type { FormRecord } from "./types";

export type MailSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  notifyEmail: string;
  thankYouSubject: string;
  thankYouBody: string;
  notifySubject: string;
  notifyBody: string;
};

export const DEFAULT_MAIL: MailSettings = {
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  notifyEmail: "",
  thankYouSubject: "Thank you for filling the form",
  thankYouBody:
    "Hi {{name}},\n\nThank you for filling the form.\n\nWe have received your response for {{form}}.\n\n{{score_line}}\n\n— CareerSparks",
  notifySubject: "New response: {{form}} — {{name}}",
  notifyBody:
    "New response on {{form}}.\n\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nScore: {{score}}\nSource: {{source}}\n\nOpen the admin dashboard to review.",
};

type SettingsRow = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
  thank_you_subject: string;
  thank_you_body: string;
  notify_subject: string;
  notify_body: string;
};

export function mapSettings(row?: SettingsRow | null): MailSettings {
  if (!row) return { ...DEFAULT_MAIL };
  return {
    smtpHost: row.smtp_host,
    smtpPort: Number(row.smtp_port) || 465,
    smtpUser: row.smtp_user,
    smtpPass: row.smtp_pass,
    smtpFrom: row.smtp_from,
    notifyEmail: row.notify_email,
    thankYouSubject: row.thank_you_subject,
    thankYouBody: row.thank_you_body,
    notifySubject: row.notify_subject,
    notifyBody: row.notify_body,
  };
}

export async function loadMailSettings(): Promise<MailSettings> {
  const sql = await getSql();
  await sql`insert into workspace_settings (workspace_id) values (${WORKSPACE_ID}) on conflict (workspace_id) do nothing`;
  const rows = await sql<SettingsRow>`select * from workspace_settings where workspace_id = ${WORKSPACE_ID} limit 1`;
  const mapped = mapSettings(rows[0]);
  const env = (key: string) => {
    const v = typeof process !== "undefined" ? process.env[key]?.trim() : "";
    return v || "";
  };
  return {
    ...mapped,
    smtpHost: mapped.smtpHost || env("SMTP_HOST") || "smtp.hostinger.com",
    smtpPort: mapped.smtpPort || Number(env("SMTP_PORT") || 465) || 465,
    smtpUser: mapped.smtpUser || env("SMTP_USER") || env("SMTP_USERNAME"),
    smtpPass: mapped.smtpPass || env("SMTP_PASS") || env("SMTP_PASSWORD"),
    smtpFrom: mapped.smtpFrom || env("SMTP_FROM") || mapped.smtpUser || env("SMTP_USER"),
    notifyEmail: mapped.notifyEmail || env("NOTIFY_EMAIL") || mapped.smtpFrom || mapped.smtpUser,
  };
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function smtpReady(opts: MailSettings) {
  return Boolean(opts.smtpHost && opts.smtpUser && opts.smtpPass && (opts.smtpFrom || opts.smtpUser));
}

function readLine(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (buf: Buffer) => {
      socket.off("error", onErr);
      resolve(buf.toString("utf8"));
    };
    const onErr = (err: Error) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.once("data", onData);
    socket.once("error", onErr);
  });
}

async function readReply(socket: net.Socket): Promise<string> {
  let acc = "";
  for (;;) {
    acc += await readLine(socket);
    const lines = acc.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    const last = lines[lines.length - 1] || "";
    if (/^\d{3} /.test(last)) return acc;
    if (lines.length > 12) return acc;
  }
}

async function expectOk(socket: net.Socket, expected: string) {
  const raw = await readReply(socket);
  const lines = raw.replace(/\r/g, "").split("\n").filter(Boolean);
  const last = lines[lines.length - 1] || raw.trim();
  if (!last.startsWith(expected)) {
    throw new Error(`SMTP error: ${last.slice(0, 180)}`);
  }
  return raw;
}

async function write(socket: net.Socket, cmd: string) {
  socket.write(cmd + "\r\n");
}

async function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, host, servername: host }, () => resolve(secure));
    secure.once("error", reject);
  });
}

export async function sendSmtpEmail(opts: {
  settings: MailSettings;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const { settings, to, subject, text } = opts;
  const from = settings.smtpFrom || settings.smtpUser;
  const port = settings.smtpPort || 465;
  const host = settings.smtpHost;
  const implicitTls = port === 465;

  const socket: net.Socket = await new Promise((resolve, reject) => {
    const onErr = (err: Error) => reject(err);
    if (implicitTls) {
      const s = tls.connect({ host, port, servername: host }, () => resolve(s));
      s.once("error", onErr);
    } else {
      const s = net.connect({ host, port }, () => resolve(s));
      s.once("error", onErr);
    }
  });
  socket.setTimeout(20000, () => socket.destroy(new Error("SMTP timeout")));

  try {
    await expectOk(socket, "220");
    await write(socket, `EHLO careersparksco.in`);
    const ehlo = await readReply(socket);
    let conn: net.Socket = socket;
    if (!implicitTls && /STARTTLS/i.test(ehlo)) {
      await write(socket, "STARTTLS");
      await expectOk(socket, "220");
      conn = await upgradeToTls(socket, host);
      await write(conn, `EHLO careersparksco.in`);
      await readReply(conn);
    }
    await write(conn, "AUTH LOGIN");
    await expectOk(conn, "334");
    await write(conn, Buffer.from(settings.smtpUser).toString("base64"));
    await expectOk(conn, "334");
    await write(conn, Buffer.from(settings.smtpPass).toString("base64"));
    await expectOk(conn, "235");
    await write(conn, `MAIL FROM:<${from}>`);
    await expectOk(conn, "250");
    await write(conn, `RCPT TO:<${to}>`);
    await expectOk(conn, "250");
    await write(conn, "DATA");
    await expectOk(conn, "354");
    const payload = [
      `From: CareerSparks <${from}>`,
      `To: ${to}`,
      `Subject: ${subject.replace(/\r?\n/g, " ")}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      text.replace(/^\./gm, ".."),
      ".",
    ].join("\r\n");
    conn.write(payload + "\r\n");
    await expectOk(conn, "250");
    await write(conn, "QUIT");
  } finally {
    socket.end();
  }
}

async function enqueueAndSend(input: {
  kind: "thank_you" | "notify" | "test";
  to: string;
  subject: string;
  body: string;
  formId?: string;
  responseId?: string;
  settings: MailSettings;
}) {
  const sql = await getSql();
  const id = nid();
  const ready = smtpReady(input.settings) && Boolean(input.to.includes("@"));
  const initial = ready ? "queued" : "preview";
  await sql`insert into email_outbox (id, workspace_id, form_id, response_id, kind, to_email, subject, body, status)
    values (${id}, ${WORKSPACE_ID}, ${input.formId ?? null}, ${input.responseId ?? null}, ${input.kind}, ${input.to}, ${input.subject}, ${input.body}, ${initial})`;
  if (!ready) return { id, status: initial };
  try {
    await sendSmtpEmail({
      settings: input.settings,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    await sql`update email_outbox set status = ${"sent"}, sent_at = now(), error = null where id = ${id}`;
    return { id, status: "sent" as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await sql`update email_outbox set status = ${"error"}, error = ${message} where id = ${id}`;
    return { id, status: "error" as const };
  }
}

export async function queueFormEmails(input: {
  form: FormRecord;
  responseId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  score: number | null;
  maxScore: number | null;
}) {
  const settings = await loadMailSettings();
  const vars = {
    form: input.form.title,
    name: input.name || "there",
    email: input.email || "—",
    phone: input.phone || "—",
    source: input.source,
    score:
      input.score != null && input.maxScore
        ? `${input.score}/${input.maxScore}`
        : "—",
    score_line:
      input.score != null && input.maxScore
        ? `Your score: ${input.score}/${input.maxScore}.`
        : "",
  };
  const thankYou = input.form.schema.settings.sendThankYouEmail !== false;
  const notify = input.form.schema.settings.notifyAdmin !== false;
  const results: Array<{ status: string }> = [];
  if (thankYou && input.email) {
    results.push(
      await enqueueAndSend({
        kind: "thank_you",
        to: input.email,
        subject: fill(settings.thankYouSubject, vars),
        body: fill(settings.thankYouBody, vars),
        formId: input.form.id,
        responseId: input.responseId,
        settings,
      }),
    );
  }
  const notifyTo = settings.notifyEmail || settings.smtpFrom || settings.smtpUser;
  if (notify && notifyTo) {
    results.push(
      await enqueueAndSend({
        kind: "notify",
        to: notifyTo,
        subject: fill(settings.notifySubject, vars),
        body: fill(settings.notifyBody, vars),
        formId: input.form.id,
        responseId: input.responseId,
        settings,
      }),
    );
  }
  return {
    emailed: results.some((r) => r.status === "sent" || r.status === "queued" || r.status === "preview"),
  };
}

export async function sendTestEmail(to: string) {
  const settings = await loadMailSettings();
  if (!to.includes("@")) throw new Error("Enter a valid email.");
  return enqueueAndSend({
    kind: "test",
    to,
    subject: "CareerSparks test email",
    body: "This is a test from CareerSparks Survey. If you received this, SMTP is working.",
    settings,
  });
}
