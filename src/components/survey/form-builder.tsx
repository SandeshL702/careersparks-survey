import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateForm } from "@/lib/survey/api";
import { blankQuestion, parseFormCode, toCodeDocument } from "@/lib/survey/schema";
import {
  CATEGORY_LABELS,
  FORM_CATEGORIES,
  QUESTION_LABELS,
  QUESTION_TYPES,
  type FormCategory,
  type FormMode,
  type FormRecord,
  type FormSchema,
  type Json,
  type Question,
  type QuestionType,
} from "@/lib/survey/types";
import { cn } from "@/lib/utils";
import { QuestionField } from "./question-field";
import { FormShare } from "./form-share";

export function FormBuilder({ form }: { form: FormRecord }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description);
  const [mode, setMode] = useState<FormMode>(form.mode);
  const [category, setCategory] = useState<FormCategory>(form.category);
  const [status, setStatus] = useState(form.status);
  const [schema, setSchema] = useState<FormSchema>(form.schema);
  const [selected, setSelected] = useState(0);
  const [code, setCode] = useState(() =>
    JSON.stringify(toCodeDocument({ title: form.title, description: form.description, mode: form.mode, category: form.category, schema: form.schema }), null, 2),
  );
  const [tab, setTab] = useState("visual");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Record<string, Json>>({});

  const question = schema.questions[selected];

  const codeSync = useMemo(
    () => JSON.stringify(toCodeDocument({ title, description, mode, category, schema }), null, 2),
    [title, description, mode, category, schema],
  );

  function patchQuestion(id: string, patch: Partial<Question>) {
    setSchema((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function addQuestion(type: QuestionType) {
    const q = blankQuestion(type);
    setSchema((s) => ({ ...s, questions: [...s.questions, q] }));
    setSelected(schema.questions.length);
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= schema.questions.length) return;
    setSchema((s) => {
      const questions = [...s.questions];
      const tmp = questions[index]!;
      questions[index] = questions[next]!;
      questions[next] = tmp;
      return { ...s, questions };
    });
    setSelected(next);
  }

  function duplicateQuestion(index: number) {
    const src = schema.questions[index];
    if (!src) return;
    const copy: Question = {
      ...src,
      id: `q_${Math.random().toString(36).slice(2, 8)}`,
      title: `${src.title} (copy)`,
    };
    setSchema((s) => {
      const questions = [...s.questions];
      questions.splice(index + 1, 0, copy);
      return { ...s, questions };
    });
    setSelected(index + 1);
  }

  function removeQuestion(index: number) {
    setSchema((s) => ({ ...s, questions: s.questions.filter((_, i) => i !== index) }));
    setSelected((i) => Math.max(0, Math.min(i, schema.questions.length - 2)));
  }

  async function save(nextStatus = status) {
    setSaving(true);
    try {
      if (tab === "code") {
        await updateForm({ data: { id: form.id, code, status: nextStatus } });
        const doc = parseFormCode(code);
        setTitle(doc.title);
        setDescription(doc.description);
        setMode(doc.mode);
        setCategory(doc.category);
        setSchema({ questions: doc.questions, settings: doc.settings });
      } else {
        await updateForm({
          data: {
            id: form.id,
            title,
            description,
            mode,
            category,
            status: nextStatus,
            schema,
          },
        });
        setCode(codeSync);
      }
      setStatus(nextStatus);
      toast.success(nextStatus === "published" ? "Published" : "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function applyCode() {
    try {
      const doc = parseFormCode(code);
      setTitle(doc.title);
      setDescription(doc.description);
      setMode(doc.mode);
      setCategory(doc.category);
      setSchema({ questions: doc.questions, settings: doc.settings });
      toast.success("Code applied to the visual builder");
      setTab("visual");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 border-transparent bg-transparent px-0 font-display text-xl font-semibold"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === "published" ? "success" : status === "closed" ? "danger" : "muted"}>
            {status}
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/f/$slug", params: { slug: form.slug } })}>
            <Eye /> Preview
          </Button>
          <Button variant="secondary" size="sm" onClick={() => save()} disabled={saving}>
            <Save /> Save
          </Button>
          <Button
            size="sm"
            onClick={() => save(status === "published" ? "closed" : "published")}
            disabled={saving}
          >
            {status === "published" ? "Close form" : "Publish"}
          </Button>
        </div>
      </div>
      <div className="border-b border-border px-4 py-3">
        <FormShare slug={form.slug} message={schema.settings.whatsappMessage} compact={false} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-2">
          <TabsList>
            <TabsTrigger value="visual">Questions</TabsTrigger>
          </TabsList>
          <p className="hidden text-xs text-muted sm:block">Need JSON? Use Forms → From code.</p>
        </div>

        <TabsContent value="visual" className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,360px)]">
            <aside className="min-h-0 overflow-y-auto border-t border-border p-3 lg:border-r lg:border-t-0">
              <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Questions
              </p>
              <div className="space-y-1">
                {schema.questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                      selected === i ? "bg-primary text-primary-fg" : "hover:bg-surface-2",
                    )}
                  >
                    <GripVertical className="size-3.5 opacity-50" />
                    <span className="truncate">{q.title}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addQuestion(t)}
                    className="min-h-9 rounded-md border border-border px-2 py-1.5 text-left text-[11px] text-muted hover:border-primary/50 hover:text-fg"
                  >
                    <Plus className="mr-1 inline size-3" />
                    {QUESTION_LABELS[t]}
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-t-0">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Mode</Label>
                  <select
                    className="mt-1 flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as FormMode)}
                  >
                    <option value="classic">Classic (all questions)</option>
                    <option value="conversational">One question at a time</option>
                  </select>
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    className="mt-1 flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FormCategory)}
                  >
                    {FORM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <Label>Description</Label>
                <Textarea className="mt-1 min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {question ? (
                <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Question</Label>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" onClick={() => moveQuestion(selected, -1)} disabled={selected === 0}>
                        <ChevronUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(selected, 1)}
                        disabled={selected === schema.questions.length - 1}
                      >
                        <ChevronDown />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicateQuestion(selected)}>
                        <Copy />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(selected)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <Input value={question.title} onChange={(e) => patchQuestion(question.id, { title: e.target.value })} />
                  <div>
                    <Label>Help text (optional)</Label>
                    <Input
                      className="mt-1"
                      value={question.description ?? ""}
                      onChange={(e) => patchQuestion(question.id, { description: e.target.value || undefined })}
                      placeholder="Shown under the question"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Type</Label>
                      <select
                        className="mt-1 flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        value={question.type}
                        onChange={(e) => {
                          const type = e.target.value as QuestionType;
                          const next = blankQuestion(type);
                          patchQuestion(question.id, {
                            type,
                            description:
                              type === "phone" || type === "email" ? next.description : question.description,
                            options: next.options ?? question.options,
                            title: question.title === "Untitled question" ? next.title : question.title,
                          });
                        }}
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {QUESTION_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="mt-6 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) => patchQuestion(question.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  {(question.type === "single" || question.type === "multiple" || question.type === "dropdown" || question.type === "yes_no") && (
                    <div>
                      <Label>Options (one per line)</Label>
                      <Textarea
                        className="mt-1 min-h-32"
                        value={(question.options || []).join("\n")}
                        onChange={(e) =>
                          patchQuestion(question.id, {
                            options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                      <p className="mt-1 text-xs text-muted">
                        Multiple choice = tap buttons. Dropdown = long lists. Checkboxes = select many.
                      </p>
                    </div>
                  )}
                  {(question.type === "single" || question.type === "multiple") && (
                    <div>
                      <Label>More options — dropdown (one per line)</Label>
                      <Textarea
                        className="mt-1 min-h-24"
                        value={(question.moreOptions || []).join("\n")}
                        onChange={(e) =>
                          patchQuestion(question.id, {
                            moreOptions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Shown as a dropdown under the main buttons"
                      />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Show only if</Label>
                      <select
                        className="mt-1 flex min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        value={question.showIf?.questionId ?? ""}
                        onChange={(e) => {
                          const questionId = e.target.value;
                          if (!questionId) patchQuestion(question.id, { showIf: undefined });
                          else
                            patchQuestion(question.id, {
                              showIf: { questionId, equals: question.showIf?.equals || "" },
                            });
                        }}
                      >
                        <option value="">Always show</option>
                        {schema.questions
                          .filter((q) => q.id !== question.id)
                          .map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    {question.showIf ? (
                      <div>
                        <Label>Answer equals</Label>
                        <Input
                          className="mt-1"
                          value={question.showIf.equals}
                          onChange={(e) =>
                            patchQuestion(question.id, {
                              showIf: { questionId: question.showIf!.questionId, equals: e.target.value },
                            })
                          }
                          placeholder="Other"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Correct answer (quiz)</Label>
                      <Input
                        value={question.correct == null ? "" : String(question.correct)}
                        onChange={(e) => patchQuestion(question.id, { correct: e.target.value || undefined })}
                      />
                    </div>
                    <div>
                      <Label>Points</Label>
                      <Input
                        type="number"
                        value={question.points ?? ""}
                        onChange={(e) =>
                          patchQuestion(question.id, {
                            points: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schema.settings.quizMode}
                      onChange={(e) =>
                        setSchema((s) => ({ ...s, settings: { ...s.settings, quizMode: e.target.checked } }))
                      }
                    />
                    Quiz mode (show score after submit)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schema.settings.sendThankYouEmail !== false}
                      onChange={(e) =>
                        setSchema((s) => ({ ...s, settings: { ...s.settings, sendThankYouEmail: e.target.checked } }))
                      }
                    />
                    Send thank-you email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schema.settings.allowMultiple === false}
                      onChange={(e) =>
                        setSchema((s) => ({ ...s, settings: { ...s.settings, allowMultiple: !e.target.checked } }))
                      }
                    />
                    One response per person
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schema.settings.notifyAdmin !== false}
                      onChange={(e) =>
                        setSchema((s) => ({ ...s, settings: { ...s.settings, notifyAdmin: e.target.checked } }))
                      }
                    />
                    Email admin on each response
                  </label>
                  <div>
                    <Label>Thank-you message</Label>
                    <Textarea
                      className="mt-1 min-h-20"
                      value={schema.settings.thankYou}
                      onChange={(e) =>
                        setSchema((s) => ({ ...s, settings: { ...s.settings, thankYou: e.target.value } }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Close after (responses)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      placeholder="Unlimited"
                      value={schema.settings.maxResponses ?? ""}
                      onChange={(e) =>
                        setSchema((s) => ({
                          ...s,
                          settings: {
                            ...s.settings,
                            maxResponses: e.target.value === "" ? undefined : Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Add a question to start building.</p>
              )}
            </section>

            <aside className="hidden min-h-0 overflow-y-auto border-l border-border p-4 lg:block">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">Live preview</p>
              {question ? (
                <div className="rounded-xl border border-border bg-bg p-4">
                  <p className="mb-3 font-medium">{question.title}</p>
                  <QuestionField
                    question={question}
                    value={preview[question.id]}
                    onChange={(v) => setPreview((p) => ({ ...p, [question.id]: v as Json }))}
                  />
                </div>
              ) : null}
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
