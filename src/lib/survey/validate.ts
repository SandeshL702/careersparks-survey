import type { Question } from "./types";

export function normalizePhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function phoneError(raw: unknown): string | null {
  const d = normalizePhone(raw);
  if (!d) return "Enter a 10-digit WhatsApp number.";
  if (d.length !== 10) return "WhatsApp number must be exactly 10 digits.";
  if (!/^[6-9]/.test(d)) return "Indian mobile numbers start with 6, 7, 8 or 9.";
  return null;
}

export function emailError(raw: unknown): string | null {
  const s = normalizeEmail(raw);
  if (!s) return "Enter a valid email.";
  if (s.length > 120) return "Email is too long.";
  if (/\s/.test(String(raw ?? ""))) return "Email cannot contain spaces.";
  const parts = s.split("@");
  if (parts.length !== 2) return "Email must look like name@gmail.com";
  const [local, domain] = parts;
  if (!local || !domain) return "Email must look like name@gmail.com";
  if (!/^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/.test(local) && !/^[a-z0-9._%+-]+$/.test(local)) {
    return "Email address is not valid.";
  }
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return "Email address is not valid.";
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain)) {
    return "Enter a proper email domain (gmail.com, outlook.com, company.com).";
  }
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const core = local.split("+")[0] || "";
    if (core.replace(/\./g, "").length < 6) return "Gmail address looks incomplete.";
    if (!/^[a-z0-9.]+$/.test(core)) return "Gmail only allows letters, numbers and dots before @.";
  }
  return null;
}

export function contactKind(question: Question): "phone" | "email" | null {
  if (question.type === "phone") return "phone";
  if (question.type === "email") return "email";
  const t = question.title.toLowerCase();
  if (/whatsapp|mobile|\bphone\b|contact number/.test(t)) return "phone";
  if (/\bemail\b|e-mail|gmail/.test(t)) return "email";
  return null;
}

export function questionValueError(question: Question, value: unknown): string | null {
  if (question.type === "statement") return null;
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  const kind = contactKind(question);
  if (empty) {
    if (!question.required) return null;
    if (kind === "phone") return "Enter a 10-digit WhatsApp number.";
    if (kind === "email") return "Enter a valid email.";
    return "This question is required.";
  }
  if (kind === "phone") return phoneError(value);
  if (kind === "email") return emailError(value);
  return null;
}
