import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FormClosed, FormPlayer, ThankYou } from "@/components/survey/form-player";
import { getPublishedForm, submitResponse, trackFormEvent } from "@/lib/survey/api";

export const Route = createFileRoute("/f/$slug")({ component: FillPage });

function FillPage() {
  const { slug } = Route.useParams();
  const [form, setForm] = useState<Awaited<ReturnType<typeof getPublishedForm>> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Awaited<ReturnType<typeof submitResponse>> | null>(null);
  const source =
    typeof window !== "undefined" && /whatsapp|wa/i.test(document.referrer)
      ? "whatsapp"
      : new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("src") || "web";

  useEffect(() => {
    let alive = true;
    getPublishedForm({ data: { slug } })
      .then((f) => {
        if (!alive) return;
        setForm(f);
        if (f) void trackFormEvent({ data: { formId: f.id, kind: "view" } });
      })
      .catch(() => {
        if (alive) setForm(null);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (form === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-40 animate-pulse rounded-md bg-surface" />
      </div>
    );
  }
  if (!form) {
    return <FormClosed title="Form not found" />;
  }
  if (form.status === "closed") {
    return <FormClosed title={form.title} />;
  }
  if (done) {
    return (
      <ThankYou
        title={done.title}
        message={done.thankYou}
        score={done.score}
        maxScore={done.maxScore}
        passPercent={done.passPercent}
        quizMode={done.quizMode}
        emailed={done.emailed}
        email={done.email}
        shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/f/${slug}?src=whatsapp`}
        shareText={form.schema.settings.whatsappMessage}
      />
    );
  }

  return (
    <FormPlayer
      slug={slug}
      title={form.title}
      description={form.description}
      mode={form.mode}
      schema={form.schema}
      submitting={submitting}
      error={error}
      onStart={() => void trackFormEvent({ data: { formId: form.id, kind: "start" } })}
      onSubmit={async (answers, durationMs) => {
        setSubmitting(true);
        setError(null);
        try {
          const res = await submitResponse({
            data: { slug, answers, durationMs, source },
          });
          setDone(res);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not submit");
        } finally {
          setSubmitting(false);
        }
      }}
    />
  );
}
