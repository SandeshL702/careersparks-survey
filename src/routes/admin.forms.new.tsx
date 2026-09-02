import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createForm } from "@/lib/survey/api";
import { FORM_TEMPLATES } from "@/lib/survey/templates";

export const Route = createFileRoute("/admin/forms/new")({ component: NewFromCode });

const SAMPLE = JSON.stringify(FORM_TEMPLATES[5], null, 2);

function NewFromCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState(SAMPLE);
  const [pending, setPending] = useState(false);

  async function onCreate(publish: boolean) {
    setPending(true);
    try {
      const created = await createForm({ data: { title: "From code", code, publish } });
      toast.success(publish ? "Published" : "Draft created");
      await navigate({ to: "/admin/forms/$formId", params: { formId: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid form code");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Code builder</p>
        <h1 className="font-display text-3xl font-semibold">Create a form from JSON</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Paste a CareerSparks form document. Required keys: title, description, mode, category, questions.
          Optional settings: quizMode, thankYou, whatsappMessage.
        </p>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        className="min-h-[480px] w-full rounded-2xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => void onCreate(false)}>
          Create draft
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => void onCreate(true)}>
          Create and publish
        </Button>
      </div>
    </div>
  );
}
