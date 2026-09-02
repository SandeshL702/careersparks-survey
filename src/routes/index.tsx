import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/spark-mark";
import { Button } from "@/components/ui/button";
import { FormShare } from "@/components/survey/form-share";
import { listPublishedForms } from "@/lib/survey/api";
import { getInstallState } from "@/lib/survey/install.server";
import type { FormCategory } from "@/lib/survey/types";

export const Route = createFileRoute("/")({
  loader: async () => {
    const state = await getInstallState();
    if (state.status !== "ready") throw redirect({ to: "/install" });
    return null;
  },
  component: Home,
});

type PublicForm = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: FormCategory;
  mode: string;
  responseCount: number;
};

function Home() {
  const [forms, setForms] = useState<PublicForm[] | null>(null);

  useEffect(() => {
    listPublishedForms()
      .then(setForms)
      .catch(() => setForms([]));
  }, []);

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="grain" />
      <header className="relative z-10 mx-auto flex max-w-3xl items-center px-4 py-5 sm:px-6">
        <Logo />
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">CareerSparks</h1>
        <p className="mt-1 text-sm text-muted">Name, WhatsApp, email — then a few taps.</p>

        {forms == null ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <p className="mt-10 text-sm text-muted">No open forms right now.</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {forms.map((form) => (
              <li key={form.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">{form.title}</h2>
                  <Button asChild size="sm">
                    <Link to="/f/$slug" params={{ slug: form.slug }}>
                      Open <ArrowRight />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4">
                  <FormShare slug={form.slug} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-center text-[11px] text-muted">
          © {new Date().getFullYear()} CareerSparks
          <Link to="/login" className="ml-3 text-muted/70 underline-offset-2 hover:text-fg hover:underline">
            Staff
          </Link>
        </p>
      </main>
    </div>
  );
}
