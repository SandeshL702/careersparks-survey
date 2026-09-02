import { nid } from "@/lib/utils";
import { scoreAnswers } from "./scoring";
import { FORM_TEMPLATES } from "./templates";
import type { FormCodeDocument, FormSchema, Json } from "./types";

export const WORKSPACE_ID = "ws_careersparks";

const FIRST_NAMES = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Ishaan", "Meera",
  "Kabir", "Diya", "Arjun", "Nisha", "Rahul", "Pooja", "Aditya", "Kavya",
  "Siddharth", "Riya", "Harsh", "Neha", "Yash", "Tanvi", "Aman", "Shreya",
];
const LAST_NAMES = [
  "Sharma", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Singh", "Verma", "Khan",
  "Reddy", "Nair", "Gupta", "Iyer", "Chopra", "Mehta", "Kamble", "Naik",
];
const CITIES = ["Nagpur", "Pune", "Mumbai", "Nashik", "Aurangabad", "Indore", "Hyderabad", "Delhi"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);
  return d.toISOString();
}

function answerFor(doc: FormCodeDocument, i: number): Record<string, Json> {
  const name = `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i * 3)}`;
  const email = `${name.toLowerCase().replace(/ /g, ".")}${i}@gmail.com`;
  const phone = `9${String(700000000 + i * 137).slice(0, 9)}`;
  const answers: Record<string, Json> = {};
  for (const q of doc.questions) {
    switch (q.type) {
      case "statement":
        break;
      case "short_text":
        if (q.id.includes("name") || q.title.toLowerCase().includes("name")) answers[q.id] = name;
        else if (q.id.includes("city") || q.title.toLowerCase().includes("city")) answers[q.id] = pick(CITIES, i);
        else if (q.id.includes("company")) answers[q.id] = pick(["Nova Retail", "BrightWorks", "Helix Labs", "CityMart"], i);
        else if (q.id.includes("role") || q.title.toLowerCase().includes("role")) answers[q.id] = "Sales Executive";
        else if (q.id.includes("edu")) answers[q.id] = pick(["B.Com", "B.E", "MBA", "B.Sc"], i);
        else if (q.id.includes("ctc") || q.id.includes("budget")) answers[q.id] = pick(["2.4 LPA", "3.6 LPA", "4.8 LPA", "6 LPA"], i);
        else answers[q.id] = pick(["Available", "Open", "Yes"], i);
        break;
      case "email":
        answers[q.id] = email;
        break;
      case "phone":
        answers[q.id] = phone;
        break;
      case "long_text":
        answers[q.id] = pick(
          [
            "I handled a festival rush and still hit the daily target.",
            "I want a stable role with growth. Ready to join soon.",
            "Strong in client conversations and follow-ups.",
          ],
          i,
        );
        break;
      case "number":
        answers[q.id] = 1 + (i % 4);
        break;
      case "date":
        answers[q.id] = daysAgo(i % 14).slice(0, 10);
        break;
      case "single":
      case "dropdown":
      case "yes_no": {
        const opts = q.options || [];
        if (q.correct && typeof q.correct === "string" && i % 5 !== 0) answers[q.id] = q.correct;
        else answers[q.id] = opts[i % Math.max(opts.length, 1)] || "Yes";
        break;
      }
      case "multiple": {
        const opts = q.options || [];
        answers[q.id] = opts.filter((_, idx) => idx % 2 === i % 2).slice(0, 2);
        break;
      }
      case "rating":
        answers[q.id] = 3 + (i % 3);
        break;
      case "nps":
        answers[q.id] = 6 + (i % 5);
        break;
      case "file":
        answers[q.id] = { name: `${name.replace(/ /g, "_")}_resume.pdf`, type: "application/pdf", size: 120000 };
        break;
      default:
        break;
    }
  }
  return answers;
}

export type SeedPlan = {
  forms: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    mode: string;
    schema: FormSchema;
    status: string;
  }>;
  responses: Array<{
    id: string;
    formId: string;
    answers: Record<string, Json>;
    score: number | null;
    maxScore: number | null;
    durationMs: number;
    source: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  events: Array<{ id: string; formId: string; kind: string; createdAt: string }>;
};

export function buildSeedPlan(): SeedPlan {
  const forms = FORM_TEMPLATES.map((doc, idx) => {
    const id = `form_seed_${idx + 1}`;
    const slug = doc.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return {
      id,
      slug,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      mode: doc.mode,
      schema: { questions: doc.questions, settings: { ...doc.settings } },
      status: "published" as const,
    };
  });

  const responses: SeedPlan["responses"] = [];
  const events: SeedPlan["events"] = [];

  forms.forEach((form, fIdx) => {
    const count = 28 + fIdx * 6;
    for (let i = 0; i < count; i += 1) {
      const doc = FORM_TEMPLATES[fIdx]!;
      const answers = answerFor(doc, i + fIdx * 11);
      const scored = scoreAnswers(form.schema, answers);
      const createdAt = daysAgo((i * 2 + fIdx) % 28);
      responses.push({
        id: nid(),
        formId: form.id,
        answers,
        score: scored.maxScore > 0 ? scored.score : null,
        maxScore: scored.maxScore > 0 ? scored.maxScore : null,
        durationMs: 45000 + ((i * 17) % 240) * 1000,
        source: i % 3 === 0 ? "whatsapp" : "web",
        name: typeof answers.q_name === "string" ? answers.q_name : null,
        email: typeof answers.q_email === "string" ? answers.q_email : null,
        phone: typeof answers.q_phone === "string" ? answers.q_phone : null,
        createdAt,
      });
      events.push({ id: nid(), formId: form.id, kind: "view", createdAt: daysAgo((i * 2 + fIdx) % 28) });
      if (i % 5 !== 0) {
        events.push({ id: nid(), formId: form.id, kind: "start", createdAt: daysAgo((i * 2 + fIdx) % 28) });
      }
      events.push({ id: nid(), formId: form.id, kind: "complete", createdAt });
    }
    for (let j = 0; j < 18; j += 1) {
      events.push({ id: nid(), formId: form.id, kind: "view", createdAt: daysAgo(j % 21) });
    }
  });

  return { forms, responses, events };
}
