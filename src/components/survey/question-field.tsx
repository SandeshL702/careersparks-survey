import { useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileAnswer, Question } from "@/lib/survey/types";
import { Input, Textarea } from "@/components/ui/input";
import { emailError, normalizeEmail, normalizePhone, phoneError } from "@/lib/survey/validate";

type Props = {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  autoFocus?: boolean;
  onCommit?: () => void;
};

function WriteIn({
  options,
  value,
  multiple,
  onChange,
  onCommit,
}: {
  options: string[];
  value: unknown;
  multiple?: boolean;
  onChange: (value: unknown) => void;
  onCommit?: () => void;
}) {
  const selected = multiple ? (Array.isArray(value) ? value.map(String) : []) : [];
  const custom = multiple
    ? selected.find((s) => !options.includes(s)) || ""
    : typeof value === "string" && value && !options.includes(value)
      ? value
      : "";
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-medium text-muted">Or type your answer</p>
      <Input
        value={custom}
        placeholder="Write here"
        onChange={(e) => {
          const t = e.target.value;
          if (multiple) {
            const kept = selected.filter((s) => options.includes(s));
            onChange(t.trim() ? [...kept, t] : kept);
          } else {
            onChange(t);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit?.();
          }
        }}
      />
    </div>
  );
}

function MoreDropdown({
  more,
  listed,
  multiple,
  value,
  onChange,
}: {
  more: string[];
  listed: string[];
  multiple?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (!more.length) return null;
  const selected = multiple ? (Array.isArray(value) ? value.map(String) : []) : [];
  const current = multiple
    ? selected.find((s) => more.includes(s)) || ""
    : typeof value === "string" && more.includes(value)
      ? value
      : "";
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-muted">More options</p>
      <select
        className="flex min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          if (multiple) {
            const kept = selected.filter((s) => !more.includes(s));
            onChange(next ? [...kept, next] : kept);
          } else {
            onChange(next);
          }
        }}
      >
        <option value="">Select from list</option>
        {more.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function QuestionField({ question, value, onChange, autoFocus, onCommit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (question.type === "statement") {
    return (
      <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
        {question.description || question.title}
      </p>
    );
  }

  if (question.type === "long_text") {
    return (
      <Textarea
        autoFocus={autoFocus}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer"
        rows={5}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit?.();
          }
        }}
      />
    );
  }

  if (question.type === "phone") {
    const digits = normalizePhone(value);
    const hint = digits ? phoneError(digits) : null;
    return (
      <div>
        <Input
          autoFocus={autoFocus}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          value={digits}
          onChange={(e) => onChange(normalizePhone(e.target.value).slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.();
            }
          }}
          placeholder="10-digit mobile"
        />
        <p className={`mt-2 text-xs ${hint ? "text-danger" : "text-muted"}`}>
          {hint || `${digits.length}/10 digits`}
        </p>
      </div>
    );
  }

  if (question.type === "email") {
    const typed = String(value ?? "");
    const hint = typed.trim() ? emailError(typed) : null;
    return (
      <div>
        <Input
          autoFocus={autoFocus}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (typed.trim()) onChange(normalizeEmail(typed));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.();
            }
          }}
          placeholder="name@gmail.com"
        />
        <p className={`mt-2 text-xs ${hint ? "text-danger" : "text-muted"}`}>
          {hint || "Use a real inbox — Gmail, Outlook or company mail."}
        </p>
      </div>
    );
  }

  if (question.type === "short_text" || question.type === "number" || question.type === "date") {
    const type = question.type === "number" ? "number" : question.type === "date" ? "date" : "text";
    return (
      <Input
        autoFocus={autoFocus}
        type={type}
        inputMode={question.type === "number" ? "numeric" : undefined}
        autoComplete={question.type === "short_text" ? "name" : undefined}
        value={String(value ?? "")}
        onChange={(e) => onChange(question.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit?.();
          }
        }}
        placeholder="Your answer"
      />
    );
  }

  if (question.type === "yes_no" || question.type === "single") {
    const options = question.options || ["Yes", "No"];
    const more = question.moreOptions || [];
    const all = [...options, ...more];
    return (
      <div>
        <div className="grid gap-2">
          {options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={cn(
                  "flex min-h-12 items-center rounded-xl border px-4 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface hover:border-primary/50",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <MoreDropdown more={more} listed={options} value={value} onChange={onChange} />
        <WriteIn options={all} value={value} onChange={onChange} onCommit={onCommit} />
      </div>
    );
  }

  if (question.type === "dropdown") {
    const options = question.options || [];
    const more = question.moreOptions || [];
    const all = more.length ? [...options, ...more] : options;
    const listed = typeof value === "string" && all.includes(value) ? value : "";
    return (
      <div>
        <select
          autoFocus={autoFocus}
          className="flex min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          value={listed}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select from list</option>
          {all.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <WriteIn options={all} value={value} onChange={onChange} onCommit={onCommit} />
      </div>
    );
  }

  if (question.type === "multiple") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const options = question.options || [];
    const more = question.moreOptions || [];
    const all = [...options, ...more];
    return (
      <div>
        <div className="grid gap-2">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])
                }
                className={cn(
                  "flex min-h-12 items-center rounded-xl border px-4 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface hover:border-primary/50",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <MoreDropdown more={more} listed={options} multiple value={value} onChange={onChange} />
        <WriteIn options={all} value={value} multiple onChange={onChange} onCommit={onCommit} />
      </div>
    );
  }

  if (question.type === "rating") {
    const max = question.max || 5;
    const current = Number(value) || 0;
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex size-12 items-center justify-center rounded-xl border transition-colors",
              current >= n
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-muted hover:border-primary/50",
            )}
            aria-label={`${n} of ${max}`}
          >
            <Star className="size-5" fill={current >= n ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "nps") {
    const current = value === 0 || value ? Number(value) : null;
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "flex size-10 items-center justify-center rounded-md border text-sm tabular-nums transition-colors",
                current === n
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface hover:border-primary/50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>Not likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
    );
  }

  if (question.type === "file") {
    const file = (value as FileAnswer | undefined) || undefined;
    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 400_000) {
              onChange({ name: f.name, type: f.type, size: f.size });
              return;
            }
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(f);
            });
            onChange({ name: f.name, type: f.type, size: f.size, dataUrl });
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 text-sm hover:border-primary/50"
        >
          {file ? file.name : "Upload file (PDF, up to 400 KB in preview)"}
        </button>
      </div>
    );
  }

  return null;
}
