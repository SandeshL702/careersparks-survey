import { z } from "zod";
import {
  DEFAULT_SETTINGS,
  FORM_CATEGORIES,
  FORM_MODES,
  QUESTION_TYPES,
  type FormCodeDocument,
  type FormSchema,
  type Json,
  type Question,
} from "./types";

const showIfSchema = z.object({
  questionId: z.string().min(1),
  equals: z.string(),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  title: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  moreOptions: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  correct: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
  points: z.number().optional(),
  showIf: showIfSchema.optional(),
});

export const settingsSchema = z.object({
  thankYou: z.string(),
  showProgress: z.boolean(),
  quizMode: z.boolean(),
  passPercent: z.number(),
  allowMultiple: z.boolean(),
  collectContact: z.boolean(),
  whatsappMessage: z.string(),
  sendThankYouEmail: z.boolean().optional().default(true),
  notifyAdmin: z.boolean().optional().default(true),
  maxResponses: z.number().optional(),
});

export const formSchemaSchema = z.object({
  questions: z.array(questionSchema),
  settings: settingsSchema,
});

export const formCodeDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  mode: z.enum(FORM_MODES),
  category: z.enum(FORM_CATEGORIES),
  questions: z.array(questionSchema).min(1),
  settings: settingsSchema.partial().optional(),
});

export function parseFormSchema(raw: unknown): FormSchema {
  const parsed = formSchemaSchema.parse(raw);
  return {
    questions: parsed.questions,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
  };
}

export function parseFormCode(raw: string): FormCodeDocument {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("JSON is invalid. Fix the syntax and try again.");
  }
  const parsed = formCodeDocumentSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join(".") || "document";
    throw new Error(`${path}: ${first?.message || "Invalid form code"}`);
  }
  return {
    title: parsed.data.title,
    description: parsed.data.description,
    mode: parsed.data.mode,
    category: parsed.data.category,
    questions: parsed.data.questions as Question[],
    settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings },
  };
}

export function toCodeDocument(input: {
  title: string;
  description: string;
  mode: FormCodeDocument["mode"];
  category: FormCodeDocument["category"];
  schema: FormSchema;
}): FormCodeDocument {
  return {
    title: input.title,
    description: input.description,
    mode: input.mode,
    category: input.category,
    questions: input.schema.questions,
    settings: input.schema.settings,
  };
}

export function blankQuestion(type: Question["type"] = "short_text"): Question {
  const id = `q_${Math.random().toString(36).slice(2, 8)}`;
  const base: Question = {
    id,
    type,
    title: "Untitled question",
    required: type !== "statement",
  };
  if (type === "single" || type === "multiple" || type === "dropdown") {
    base.options = ["Option 1", "Option 2", "Option 3"];
  }
  if (type === "yes_no") base.options = ["Yes", "No"];
  if (type === "rating") {
    base.min = 1;
    base.max = 5;
  }
  if (type === "nps") {
    base.min = 0;
    base.max = 10;
  }
  if (type === "phone") {
    base.title = "WhatsApp Number";
    base.description = "Exactly 10 digits. Indian mobile only.";
  }
  if (type === "email") {
    base.title = "Email";
    base.description = "Use a real inbox — Gmail, Outlook or company mail.";
  }
  if (type === "statement") {
    base.title = "A short note for the candidate";
    base.required = false;
  }
  return base;
}

export function blankSchema(): FormSchema {
  return {
    questions: [
      {
        id: "q_name",
        type: "short_text",
        title: "Full name",
        required: true,
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function isQuestionVisible(
  question: Question,
  answers: Record<string, Json>,
): boolean {
  if (!question.showIf) return true;
  const value = answers[question.showIf.questionId];
  if (Array.isArray(value)) return value.map(String).includes(question.showIf.equals);
  return String(value ?? "") === question.showIf.equals;
}
