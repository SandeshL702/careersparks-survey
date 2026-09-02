import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createFromTemplate } from "@/lib/survey/api";
import { FORM_TEMPLATES } from "@/lib/survey/templates";
import { CATEGORY_LABELS } from "@/lib/survey/types";

export const Route = createFileRoute("/admin/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Start faster</p>
        <h1 className="font-display text-3xl font-semibold">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Recruitment-ready forms. Duplicate into your workspace, then edit visually or in JSON.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FORM_TEMPLATES.map((t, index) => (
          <Card key={t.title} className="flex flex-col p-5">
            <Badge>{CATEGORY_LABELS[t.category]}</Badge>
            <h2 className="mt-3 font-display text-lg font-semibold">{t.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted">{t.description}</p>
            <p className="mt-3 text-xs text-muted">
              {t.questions.length} questions · {t.mode === "conversational" ? "one-at-a-time" : "classic"}
            </p>
            <Button
              className="mt-4 self-start"
              onClick={async () => {
                try {
                  const created = await createFromTemplate({ data: { index } });
                  await navigate({ to: "/admin/forms/$formId", params: { formId: created.id } });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create");
                }
              }}
            >
              Use template
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
