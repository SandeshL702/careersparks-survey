import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponseEditor } from "@/components/survey/response-editor";
import {
  addManualResponse,
  deleteResponses,
  exportResponsesCsv,
  getForm,
  listResponses,
  updateResponse,
} from "@/lib/survey/api";
import { answerToText } from "@/lib/survey/scoring";
import { RESPONSE_STAGES, STAGE_LABELS, type FormRecord, type ResponseRecord, type ResponseStage } from "@/lib/survey/types";
import { formatDateTime, formatDuration, waLink } from "@/lib/utils";

export const Route = createFileRoute("/admin/forms/$formId/responses")({ component: ResponsesPage });

function ResponsesPage() {
  const { formId } = Route.useParams();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [rows, setRows] = useState<ResponseRecord[] | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<ResponseRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", email: "", notes: "" });

  async function reload() {
    const [f, r] = await Promise.all([getForm({ data: { id: formId } }), listResponses({ data: { formId } })]);
    setForm(f);
    setRows(r);
  }

  useEffect(() => {
    reload().catch(() => setRows([]));
  }, [formId]);

  const questions = form?.schema.questions.filter((item) => item.type !== "statement") ?? [];
  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stage !== "all" && r.stage !== stage) return false;
      if (!needle) return true;
      return [r.respondentName, r.respondentEmail, r.respondentPhone, r.source, r.notes, r.stage, JSON.stringify(r.answers)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, stage]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  async function download() {
    try {
      const file = await exportResponsesCsv({ data: { formId } });
      const blob = new Blob([file.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} response(s)?`)) return;
    try {
      await deleteResponses({ data: { ids: selectedIds } });
      setRows((list) => list?.filter((r) => !selected[r.id]) ?? null);
      setSelected({});
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function addWalkIn() {
    try {
      await addManualResponse({
        data: {
          formId,
          respondentName: walkIn.name,
          respondentPhone: walkIn.phone,
          respondentEmail: walkIn.email || undefined,
          notes: walkIn.notes || undefined,
        },
      });
      toast.success("Walk-in added");
      setAdding(false);
      setWalkIn({ name: "", phone: "", email: "", notes: "" });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Responses</h2>
          <p className="text-sm text-muted">{rows ? `${rows.length} collected` : "Loading…"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAdding((v) => !v)}>
            <Plus /> Walk-in
          </Button>
          {selectedIds.length ? (
            <Button variant="ghost" className="text-danger" onClick={() => void bulkDelete()}>
              <Trash2 /> Delete {selectedIds.length}
            </Button>
          ) : null}
          <Button onClick={() => void download()}>
            <Download /> Export CSV
          </Button>
        </div>
      </div>
      {adding ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={walkIn.name} onChange={(e) => setWalkIn((w) => ({ ...w, name: e.target.value }))} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input className="mt-1" value={walkIn.phone} onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input className="mt-1" value={walkIn.email} onChange={(e) => setWalkIn((w) => ({ ...w, email: e.target.value }))} />
          </div>
          <div>
            <Label>Note</Label>
            <Input className="mt-1" value={walkIn.notes} onChange={(e) => setWalkIn((w) => ({ ...w, notes: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void addWalkIn()} disabled={!walkIn.name || walkIn.phone.replace(/\D/g, "").length < 10}>
              Save walk-in
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, answers" />
        <select
          className="flex min-h-11 rounded-md border border-border bg-surface px-3 text-sm"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="all">All stages</option>
          {RESPONSE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    const on = e.target.checked;
                    const next: Record<string, boolean> = {};
                    if (on) filtered.forEach((r) => (next[r.id] = true));
                    setSelected(next);
                  }}
                />
              </th>
              <th className="px-3 py-3 font-medium">When</th>
              <th className="px-3 py-3 font-medium">Person</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Score</th>
              <th className="px-3 py-3 font-medium">Time</th>
              {questions.slice(0, 3).map((item) => (
                <th key={item.id} className="px-3 py-3 font-medium">
                  {item.title}
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const wa = waLink(r.respondentPhone);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[r.id])}
                      onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div>{r.respondentName || "—"}</div>
                    <div className="text-xs text-muted">{r.respondentPhone || r.respondentEmail}</div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                      value={r.stage}
                      onChange={(e) => {
                        const next = e.target.value as ResponseStage;
                        setRows((list) => list?.map((row) => (row.id === r.id ? { ...row, stage: next } : row)) ?? null);
                        void updateResponse({ data: { id: r.id, stage: next } }).catch(() => toast.error("Could not update"));
                      }}
                    >
                      {RESPONSE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 capitalize text-muted">{r.source}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {r.score != null && r.maxScore != null ? `${r.score}/${r.maxScore}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted">{formatDuration(r.durationMs)}</td>
                  {questions.slice(0, 3).map((item) => (
                    <td key={item.id} className="max-w-[180px] truncate px-3 py-3 text-muted">
                      {answerToText(r.answers[item.id])}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil />
                      </Button>
                      {wa ? (
                        <Button size="sm" variant="ghost" onClick={() => window.open(wa, "_blank")}>
                          <MessageCircle />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows && filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No responses match.</p>
        ) : null}
      </div>
      {editing && form ? (
        <ResponseEditor
          form={form}
          response={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => setRows((list) => list?.map((r) => (r.id === next.id ? next : r)) ?? null)}
          onDeleted={() => setRows((list) => list?.filter((r) => r.id !== editing.id) ?? null)}
        />
      ) : null}
    </div>
  );
}
