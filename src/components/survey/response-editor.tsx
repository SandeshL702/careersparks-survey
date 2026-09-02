import { useState } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteResponse, updateResponse } from "@/lib/survey/api";
import { STAGE_LABELS, RESPONSE_STAGES, type FormRecord, type Json, type ResponseRecord, type ResponseStage } from "@/lib/survey/types";
import { waLink } from "@/lib/utils";
import { QuestionField } from "./question-field";

export function ResponseEditor({
  form,
  response,
  onClose,
  onSaved,
  onDeleted,
}: {
  form: FormRecord;
  response: ResponseRecord;
  onClose: () => void;
  onSaved: (next: ResponseRecord) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(response);
  const [answers, setAnswers] = useState<Record<string, Json>>(response.answers);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateResponse({
        data: {
          id: response.id,
          answers,
          respondentName: draft.respondentName || "",
          respondentEmail: draft.respondentEmail || "",
          respondentPhone: draft.respondentPhone || "",
          notes: draft.notes,
          starred: draft.starred,
          reviewed: draft.reviewed,
          stage: draft.stage,
        },
      });
      const next = { ...draft, answers };
      onSaved(next);
      toast.success("Response saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this response? This cannot be undone.")) return;
    try {
      await deleteResponse({ data: { id: response.id } });
      onDeleted();
      toast.success("Response deleted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  const wa = waLink(draft.respondentPhone);
  const questions = form.schema.questions.filter((q) => q.type !== "statement");

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Edit response</p>
            <h2 className="font-display text-lg font-semibold">{draft.respondentName || "Untitled"}</h2>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={draft.respondentName || ""}
                onChange={(e) => setDraft((d) => ({ ...d, respondentName: e.target.value }))}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                className="mt-1"
                value={draft.respondentPhone || ""}
                onChange={(e) => setDraft((d) => ({ ...d, respondentPhone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1"
                value={draft.respondentEmail || ""}
                onChange={(e) => setDraft((d) => ({ ...d, respondentEmail: e.target.value }))}
              />
            </div>
            <div>
              <Label>Stage</Label>
              <select
                className="mt-1 flex min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={draft.stage}
                onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value as ResponseStage }))}
              >
                {RESPONSE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.starred}
              onChange={(e) => setDraft((d) => ({ ...d, starred: e.target.checked }))}
            />
            Star
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.reviewed}
              onChange={(e) => setDraft((d) => ({ ...d, reviewed: e.target.checked }))}
            />
            Reviewed
          </label>
          <div>
            <Label>Recruiter notes</Label>
            <Textarea
              className="mt-1"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id}>
                <Label>{q.title}</Label>
                <div className="mt-1">
                  <QuestionField
                    question={q}
                    value={answers[q.id]}
                    onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v as Json }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {wa ? (
            <Button variant="secondary" className="min-h-11" onClick={() => window.open(wa, "_blank")}>
              <MessageCircle /> WhatsApp
            </Button>
          ) : null}
          <Button variant="ghost" className="min-h-11 text-danger" onClick={() => void remove()}>
            <Trash2 /> Delete
          </Button>
          <Button className="ml-auto min-h-11" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
