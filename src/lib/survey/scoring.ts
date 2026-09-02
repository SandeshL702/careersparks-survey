import type { FileAnswer, FormSchema, Json, Question } from "./types";
import { contactKind, normalizeEmail, normalizePhone } from "./validate";

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === "") return [];
  return [String(value)];
}

export function scoreAnswers(
  schema: FormSchema,
  answers: Record<string, Json>,
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const q of schema.questions) {
    const pts = q.points ?? 0;
    if (!pts || q.correct == null || q.type === "statement") continue;
    maxScore += pts;
    if (isCorrect(q, answers[q.id])) score += pts;
  }
  return { score, maxScore };
}

export function isCorrect(question: Question, answer: unknown): boolean {
  if (question.correct == null) return false;
  if (question.type === "multiple") {
    const expected = asList(question.correct).slice().sort();
    const got = asList(answer).slice().sort();
    return expected.length > 0 && expected.join("|") === got.join("|");
  }
  if (typeof question.correct === "number") {
    return Number(answer) === question.correct;
  }
  return String(answer ?? "") === String(question.correct);
}

export function extractContact(
  answers: Record<string, Json>,
  questions?: { id: string; type: string; title: string }[],
): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  if (questions) {
    for (const q of questions) {
      const s = typeof answers[q.id] === "string" ? String(answers[q.id]).trim() : "";
      if (!s) continue;
      if (q.type === "email" && !email) email = s;
      if (q.type === "phone" && !phone) phone = s;
      if (!name && q.type === "short_text" && /name/i.test(q.title)) name = s;
    }
  }
  for (const [key, value] of Object.entries(answers)) {
    const k = key.toLowerCase();
    const s = typeof value === "string" ? value.trim() : "";
    if (!s) continue;
    if (!name && (k.includes("name") || k === "q_name")) name = s;
    if (!email && (k.includes("email") || /@/.test(s))) email = s;
    if (!phone && (k.includes("phone") || k.includes("mobile") || /^\+?\d{10,}$/.test(s))) {
      phone = s;
    }
  }
  return { name, email, phone };
}

export function answerToText(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map(String).join("; ");
  if (typeof value === "object" && value && "name" in value) {
    const f = value as FileAnswer;
    return f.name || "file";
  }
  return String(value);
}

const MAX_FILE_BYTES = 400_000;

export function sanitizeAnswers(
  schema: FormSchema,
  answers: Record<string, Json>,
): Record<string, Json> {
  const out: Record<string, Json> = {};
  const allowed = new Set(schema.questions.map((q) => q.id));
  for (const [key, value] of Object.entries(answers)) {
    if (!allowed.has(key)) continue;
    const q = schema.questions.find((item) => item.id === key);
    if (!q || q.type === "statement") continue;
    if (q.type === "file") {
      const f = value as FileAnswer | null;
      if (!f || typeof f !== "object") continue;
      const size = Number(f.size) || 0;
      if (size > MAX_FILE_BYTES) {
        out[key] = { name: String(f.name || "file"), type: String(f.type || ""), size };
      } else {
        const file: { [k: string]: Json } = {
          name: String(f.name || "file"),
          type: String(f.type || "application/octet-stream"),
          size,
        };
        if (typeof f.dataUrl === "string") file.dataUrl = f.dataUrl.slice(0, MAX_FILE_BYTES * 2);
        out[key] = file;
      }
      continue;
    }
    if (contactKind(q) === "phone") {
      out[key] = normalizePhone(value);
      continue;
    }
    if (contactKind(q) === "email") {
      out[key] = normalizeEmail(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}
