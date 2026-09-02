export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "single",
  "multiple",
  "dropdown",
  "yes_no",
  "rating",
  "nps",
  "file",
  "statement",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const FORM_CATEGORIES = [
  "application",
  "screening",
  "client",
  "feedback",
  "event",
  "pulse",
] as const;

export type FormCategory = (typeof FORM_CATEGORIES)[number];

export const FORM_STATUSES = ["draft", "published", "closed"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_MODES = ["classic", "conversational"] as const;
export type FormMode = (typeof FORM_MODES)[number];

export const MEMBER_ROLES = ["owner", "recruiter", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const RESPONSE_STAGES = ["new", "contacted", "shortlisted", "rejected", "joined"] as const;
export type ResponseStage = (typeof RESPONSE_STAGES)[number];

export const STAGE_LABELS: Record<ResponseStage, string> = {
  new: "New",
  contacted: "Contacted",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  joined: "Joined",
};

export type ShowIf = {
  questionId: string;
  equals: string;
};

export type Question = {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  moreOptions?: string[];
  min?: number;
  max?: number;
  correct?: string | string[] | number;
  points?: number;
  showIf?: ShowIf;
};

export type FormSettings = {
  thankYou: string;
  showProgress: boolean;
  quizMode: boolean;
  passPercent: number;
  allowMultiple: boolean;
  collectContact: boolean;
  whatsappMessage: string;
  sendThankYouEmail: boolean;
  notifyAdmin: boolean;
  maxResponses?: number;
};

export type FormSchema = {
  questions: Question[];
  settings: FormSettings;
};

export type FormCodeDocument = {
  title: string;
  description: string;
  mode: FormMode;
  category: FormCategory;
  questions: Question[];
  settings: FormSettings;
};

export type FormRecord = {
  id: string;
  workspaceId: string;
  createdBy: string;
  slug: string;
  title: string;
  description: string;
  category: FormCategory;
  schema: FormSchema;
  status: FormStatus;
  mode: FormMode;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
};

export type ResponseRecord = {
  id: string;
  formId: string;
  answers: Record<string, Json>;
  score: number | null;
  maxScore: number | null;
  durationMs: number | null;
  source: string;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentPhone: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  reviewed: boolean;
  starred: boolean;
  notes: string;
  respondentUserId: string | null;
  stage: ResponseStage;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type FileAnswer = {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
};

export const DEFAULT_SETTINGS: FormSettings = {
  thankYou: "Thank you. CareerSparks has received your response.",
  showProgress: true,
  quizMode: false,
  passPercent: 60,
  allowMultiple: false,
  collectContact: false,
  whatsappMessage:
    "CareerSparks is collecting responses. Takes 2 minutes — tap to fill:",
  sendThankYouEmail: true,
  notifyAdmin: true,
};

export const QUESTION_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  single: "Multiple choice",
  multiple: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  rating: "Star rating",
  nps: "NPS (0–10)",
  file: "File upload",
  statement: "Statement",
};

export const CATEGORY_LABELS: Record<FormCategory, string> = {
  application: "Job application",
  screening: "Screening quiz",
  client: "Client intake",
  feedback: "Interview feedback",
  event: "Walk-in / event",
  pulse: "Pulse / community",
};
