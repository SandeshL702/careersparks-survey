import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteResponse, listInbox, setResponseFlags, updateResponse } from "@/lib/survey/api";
import { RESPONSE_STAGES, STAGE_LABELS, type ResponseStage } from "@/lib/survey/types";
import { cn, formatDateTime, waLink } from "@/lib/utils";

export const Route = createFileRoute("/admin/inbox")({ component: InboxPage });

function InboxPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listInbox>> | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");

  useEffect(() => {
    listInbox()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stage !== "all" && r.stage !== stage) return false;
      if (!needle) return true;
      return [r.name, r.email, r.phone, r.formTitle, r.notes].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, stage]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Across forms</p>
        <h1 className="font-display text-3xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-muted">Search, stage, WhatsApp, edit or delete from each form’s responses.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" />
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
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {rows == null ? (
          <p className="p-6 text-sm text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">No responses yet.</p>
        ) : (
          filtered.map((r) => {
            const wa = waLink(r.phone);
            return (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    to="/admin/forms/$formId/responses"
                    params={{ formId: r.formId }}
                    className="font-medium hover:text-primary"
                  >
                    {r.name || r.phone || r.email || "Anonymous"}
                  </Link>
                  <p className="text-xs text-muted">
                    {r.formTitle} · {r.source} · {formatDateTime(r.createdAt)}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <select
                    className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
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
                  {wa ? (
                    <Button size="sm" variant="ghost" onClick={() => window.open(wa, "_blank")}>
                      <MessageCircle />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = !r.starred;
                      setRows((list) => list?.map((row) => (row.id === r.id ? { ...row, starred: next } : row)) ?? null);
                      void setResponseFlags({ data: { id: r.id, starred: next } }).catch(() => toast.error("Could not update"));
                    }}
                  >
                    <Star className={cn("size-4", r.starred && "fill-primary text-primary")} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => {
                      if (!window.confirm("Delete this response?")) return;
                      void deleteResponse({ data: { id: r.id } })
                        .then(() => {
                          setRows((list) => list?.filter((row) => row.id !== r.id) ?? null);
                          toast.success("Deleted");
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not delete"));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
