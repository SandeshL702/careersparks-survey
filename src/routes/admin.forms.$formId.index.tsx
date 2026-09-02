import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FormBuilder } from "@/components/survey/form-builder";
import { getForm } from "@/lib/survey/api";
import type { FormRecord } from "@/lib/survey/types";

export const Route = createFileRoute("/admin/forms/$formId/")({ component: BuilderPage });

function BuilderPage() {
  const { formId } = Route.useParams();
  const [form, setForm] = useState<FormRecord | null | undefined>(undefined);

  useEffect(() => {
    getForm({ data: { id: formId } }).then(setForm).catch(() => setForm(null));
  }, [formId]);

  if (form === undefined) {
    return <div className="h-96 animate-pulse bg-surface" />;
  }
  if (!form) {
    return <p className="p-6 text-sm text-muted">Form not found.</p>;
  }
  return <FormBuilder form={form} />;
}
