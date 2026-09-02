import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createForm, deleteForm, duplicateForm, listForms } from "@/lib/survey/api";
import { CATEGORY_LABELS, type FormRecord } from "@/lib/survey/types";
import { formatNumber } from "@/lib/utils";
import { FormShare } from "@/components/survey/form-share";

export const Route = createFileRoute("/admin/forms/")({ component: FormsPage });

function FormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormRecord[] | null>(null);

  async function reload() {
    const rows = await listForms();
    setForms(rows);
  }

  useEffect(() => {
    reload().catch(() => setForms([]));
  }, []);

  async function onCreate() {
    try {
      const created = await createForm({ data: { title: "Untitled form" } });
      await navigate({ to: "/admin/forms/$formId", params: { formId: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Library</p>
          <h1 className="font-display text-3xl font-semibold">Forms</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/admin/forms/new">From code</Link>
          </Button>
          <Button onClick={() => void onCreate()}>
            <Plus /> New form
          </Button>
        </div>
      </div>
      {forms == null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/admin/forms/$formId"
                  params={{ formId: form.id }}
                  className="min-w-0"
                >
                  <h2 className="font-display text-lg font-semibold hover:text-primary">{form.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{form.description}</p>
                </Link>
                <Badge tone={form.status === "published" ? "success" : form.status === "closed" ? "danger" : "muted"}>
                  {form.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{CATEGORY_LABELS[form.category]}</span>
                <span>·</span>
                <span className="tabular-nums">{formatNumber(form.responseCount)} responses</span>
                <span>·</span>
                <span>/{form.slug}</span>
              </div>
              <div className="mt-4">
                <FormShare slug={form.slug} message={form.schema.settings.whatsappMessage} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/admin/forms/$formId" params={{ formId: form.id }}>
                    Edit
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin/forms/$formId/analytics" params={{ formId: form.id }}>
                    Analytics
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const copy = await duplicateForm({ data: { id: form.id } });
                    toast.success("Duplicated");
                    await navigate({ to: "/admin/forms/$formId", params: { formId: copy.id } });
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("Delete this form and its responses?")) return;
                    await deleteForm({ data: { id: form.id } });
                    toast.success("Deleted");
                    await reload();
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
