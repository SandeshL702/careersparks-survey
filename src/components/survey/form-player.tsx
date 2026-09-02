import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/spark-mark";
import { isQuestionVisible } from "@/lib/survey/schema";
import { answerToText, extractContact } from "@/lib/survey/scoring";
import { checkContactTaken } from "@/lib/survey/api";
import { contactKind, emailError, questionValueError } from "@/lib/survey/validate";
import type { FormMode, FormSchema, Json, Question } from "@/lib/survey/types";
import { cn } from "@/lib/utils";
import { QuestionField } from "./question-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  slug?: string;
  title: string;
  description: string;
  mode: FormMode;
  schema: FormSchema;
  submitting?: boolean;
  error?: string | null;
  onStart?: () => void;
  onSubmit: (answers: Record<string, Json>, durationMs: number) => void | Promise<void>;
};

export function FormPlayer({
  slug,
  title,
  description,
  mode,
  schema,
  submitting,
  error,
  onStart,
  onSubmit,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [step, setStep] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [started, setStarted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [draftNote, setDraftNote] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const visible = useMemo(
    () => schema.questions.filter((q) => isQuestionVisible(q, answers)),
    [schema.questions, answers],
  );

  const current = visible[Math.min(step, visible.length - 1)];
  const progress = visible.length ? Math.round(((Math.min(step, visible.length - 1) + (review ? 1 : 0)) / visible.length) * 100) : 0;

  useEffect(() => {
    if (!slug) return;
    try {
      const raw = window.localStorage.getItem(`cs-draft:${slug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { answers?: Record<string, Json>; step?: number };
      if (parsed.answers && Object.keys(parsed.answers).length) {
        setAnswers(parsed.answers);
        setStep(parsed.step || 0);
        setDraftNote(true);
      }
    } catch {
      /* ignore */
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    try {
      window.localStorage.setItem(`cs-draft:${slug}`, JSON.stringify({ answers, step }));
    } catch {
      /* ignore */
    }
  }, [slug, answers, step]);

  useEffect(() => {
    if (step >= visible.length && visible.length) setStep(visible.length - 1);
  }, [visible.length, step]);

  function markStart() {
    if (!started) {
      setStarted(true);
      onStart?.();
    }
  }

  function setValue(id: string, value: unknown) {
    markStart();
    setAnswers((prev) => ({ ...prev, [id]: value as Json }));
    setLocalError(null);
    setDraftNote(false);
  }

  function validate(q = current, bag = answers): string | null {
    if (!q) return null;
    return questionValueError(q, bag[q.id]);
  }

  async function goNext(bag = answers) {
    const err = validate(current, bag);
    if (err) {
      setLocalError(err);
      return;
    }
    if (slug && schema.settings.allowMultiple === false && current) {
      const v = String(bag[current.id] ?? "");
      const kind = contactKind(current);
      if (kind === "phone" || kind === "email") {
        try {
          const res = await checkContactTaken({
            data: {
              slug,
              phone: kind === "phone" ? v : undefined,
              email: kind === "email" ? v : undefined,
            },
          });
          if (res.taken) {
            setLocalError(res.message);
            return;
          }
        } catch {
          /* allow continue if check fails */
        }
      }
    }
    if (step < visible.length - 1) {
      setReview(false);
      setStep((s) => s + 1);
      return;
    }
    setReview(true);
  }

  async function finish() {
    for (const q of visible) {
      const err = validate(q, answers);
      if (err) {
        setLocalError(`${q.title}: ${err}`);
        const idx = visible.findIndex((item) => item.id === q.id);
        if (idx >= 0) {
          setReview(false);
          setStep(idx);
        }
        return;
      }
    }
    let bag = answers;
    if (schema.settings.sendThankYouEmail !== false) {
      const contact = extractContact(bag, schema.questions);
      const typed = confirmEmail.trim();
      if (!contact.email && !typed) {
        setReview(true);
        setLocalError("Enter your email so we can send a thank-you confirmation.");
        return;
      }
      if (!contact.email && typed) {
        const mailErr = emailError(typed);
        if (mailErr) {
          setLocalError(mailErr);
          return;
        }
        bag = { ...bag, q_email: typed };
        setAnswers(bag);
      }
    }
    if (slug && schema.settings.allowMultiple === false) {
      const c = extractContact(bag, schema.questions);
      try {
        const res = await checkContactTaken({
          data: { slug, phone: c.phone || undefined, email: c.email || confirmEmail || undefined },
        });
        if (res.taken) {
          setLocalError(res.message);
          return;
        }
      } catch {
        /* submit still enforces */
      }
    }
    await onSubmit(bag, Date.now() - startedAt);
    if (slug) {
      try {
        window.localStorage.removeItem(`cs-draft:${slug}`);
      } catch {
        /* ignore */
      }
    }
  }

  const autoAdvance =
    current &&
    (current.type === "single" || current.type === "yes_no" || current.type === "rating" || current.type === "nps");
  const knownEmail = extractContact(answers, schema.questions).email;
  const askEmail = schema.settings.sendThankYouEmail !== false && !knownEmail;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Logo markClassName="size-6" />
        {schema.settings.showProgress && (
          <span className="text-xs tabular-nums text-muted">
            {review ? "Review" : `${Math.min(step + 1, visible.length)} / ${visible.length}`}
          </span>
        )}
      </div>
      {schema.settings.showProgress && (
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${review ? 100 : progress}%` }}
          />
        </div>
      )}
      {draftNote ? (
        <p className="mb-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Your previous answers were restored. Continue from where you left off.
        </p>
      ) : null}

      {mode === "conversational" && current && !review ? (
        <div className="flex flex-1 flex-col">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">{title}</p>
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
            {current.title}
            {current.required && current.type !== "statement" ? <span className="text-primary"> *</span> : null}
          </h1>
          {current.description ? <p className="mt-2 text-sm text-muted">{current.description}</p> : null}
          <div className="mt-8">
            <QuestionField
              key={current.id}
              question={current}
              value={answers[current.id]}
              autoFocus
              onCommit={() => goNext()}
              onChange={(v) => {
                setValue(current.id, v);
                if (autoAdvance) {
                  window.setTimeout(() => goNext({ ...answers, [current.id]: v as Json }), 180);
                }
              }}
            />
          </div>
          {(localError || error) && <p className="mt-4 text-sm text-danger">{localError || error}</p>}
          <p className="mt-6 text-xs text-muted">
            {autoAdvance ? "Tap an option to continue — or type below" : "Pick from the list, type, then Continue"}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft /> Back
            </Button>
            {!current.required && current.type !== "statement" ? (
              <Button type="button" variant="ghost" className="min-h-12" onClick={() => goNext()}>
                Skip
              </Button>
            ) : null}
            <Button type="button" className="min-h-12" onClick={() => goNext()} disabled={submitting}>
              {step === visible.length - 1 ? (
                <>
                  Review <Check />
                </>
              ) : (
                <>
                  Continue <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : review && mode === "conversational" ? (
        <ReviewAnswers
          title={title}
          visible={visible}
          answers={answers}
          error={localError || error}
          submitting={submitting}
          email={confirmEmail}
          onEmail={askEmail ? setConfirmEmail : undefined}
          onEdit={(idx) => {
            setReview(false);
            setStep(idx);
          }}
          onSubmit={() => void finish()}
        />
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">CareerSparks</p>
          <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
          {description ? <p className="mt-3 max-w-prose text-muted">{description}</p> : null}
          <div className="mt-10 space-y-6">
            {visible.map((q, i) => (
              <div key={q.id} className="rounded-2xl border border-border bg-surface p-5">
                <label className="mb-3 block text-base font-medium">
                  <span className="mr-2 text-xs tabular-nums text-muted">{i + 1}.</span>
                  {q.title}
                  {q.required && q.type !== "statement" ? <span className="text-primary"> *</span> : null}
                </label>
                {q.description ? <p className="mb-3 text-sm text-muted">{q.description}</p> : null}
                <QuestionField question={q} value={answers[q.id]} onChange={(v) => setValue(q.id, v)} />
              </div>
            ))}
          </div>
          {(localError || error) && <p className="mt-4 text-sm text-danger">{localError || error}</p>}
          {askEmail ? (
            <div className="mt-6">
              <Label>Email for thank-you confirmation</Label>
              <Input
                className="mt-1"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
            </div>
          ) : null}
          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 p-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <Button
              type="button"
              size="lg"
              onClick={() => void finish()}
              disabled={submitting}
              className="min-h-12 w-full sm:w-auto"
            >
              {submitting ? "Submitting…" : "Submit response"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewAnswers({
  title,
  visible,
  answers,
  error,
  submitting,
  email,
  onEmail,
  onEdit,
  onSubmit,
}: {
  title: string;
  visible: Question[];
  answers: Record<string, Json>;
  error?: string | null;
  submitting?: boolean;
  email?: string;
  onEmail?: (value: string) => void;
  onEdit: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">{title}</p>
      <h1 className="font-display text-2xl font-semibold">Check your answers</h1>
      <p className="mt-2 text-sm text-muted">Tap any row to edit before sending.</p>
      <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {visible
          .filter((q) => q.type !== "statement")
          .map((q) => {
            const idx = visible.findIndex((item) => item.id === q.id);
            const text = answerToText(answers[q.id]) || "—";
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onEdit(idx)}
                className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{q.title}</span>
                  <span className="mt-0.5 block truncate text-sm">{text}</span>
                </span>
                <span className="shrink-0 text-xs text-primary">Edit</span>
              </button>
            );
          })}
      </div>
      {onEmail ? (
        <div className="mt-6">
          <Label>Email for thank-you confirmation</Label>
          <Input
            className="mt-1"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="secondary" className="min-h-12" onClick={() => onEdit(visible.length - 1)}>
          <ArrowLeft /> Back
        </Button>
        <Button type="button" className="min-h-12" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"} <Check />
        </Button>
      </div>
    </div>
  );
}

export function FormClosed({ title }: { title: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <Logo className="mb-8 justify-center" />
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-muted">This form is closed and is no longer accepting responses.</p>
      </div>
    </div>
  );
}

export function ThankYou({
  title,
  message,
  score,
  maxScore,
  passPercent,
  quizMode,
  emailed,
  email,
  shareUrl,
  shareText,
}: {
  title: string;
  message: string;
  score: number | null;
  maxScore: number | null;
  passPercent: number;
  quizMode: boolean;
  emailed?: boolean;
  email?: string | null;
  shareUrl?: string;
  shareText?: string;
}) {
  const pct = score != null && maxScore ? Math.round((score / maxScore) * 100) : null;
  const passed = pct != null ? pct >= passPercent : null;
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className={cn("max-w-md text-center stagger-in")}>
        <Logo className="mb-8 justify-center" />
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-muted">{message}</p>
        {emailed && email ? (
          <p className="mt-3 text-sm text-primary">A thank-you email is on the way to {email}.</p>
        ) : null}
        {quizMode && pct != null && maxScore != null && (
          <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Your score</p>
            <p className="mt-2 font-display text-5xl font-semibold tabular-nums text-primary">
              {score}
              <span className="text-2xl text-muted">/{maxScore}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {pct}% {passed ? "— passed" : "— below pass mark"}
            </p>
          </div>
        )}
        {shareUrl ? (
          <a
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText || "Fill this CareerSparks form:"} ${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="size-4" /> Share on WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
