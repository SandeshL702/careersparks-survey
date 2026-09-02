import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsesLine, SourcePie } from "@/components/survey/charts";
import { getDashboardStats } from "@/lib/survey/api";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) {
    return <div className="p-6 text-sm text-danger">{error}</div>;
  }
  if (!stats) {
    return (
      <div className="grid gap-3 p-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: "Responses", value: formatNumber(stats.responses) },
    { label: "Views", value: formatNumber(stats.views) },
    { label: "Completion", value: `${stats.completion}%` },
    { label: "Live forms", value: formatNumber(stats.published) },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
          <h1 className="font-display text-3xl font-semibold">Overview</h1>
        </div>
        <Button asChild>
          <Link to="/admin/forms">
            Manage forms <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{k.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{k.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold">Responses · 30 days</h2>
          <ResponsesLine data={stats.daily} />
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold">Source</h2>
          <SourcePie data={stats.sources} />
        </Card>
      </div>
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">Top forms</h2>
        <div className="divide-y divide-border">
          {stats.top.map((f) => (
            <Link
              key={f.id}
              to="/admin/forms/$formId/analytics"
              params={{ formId: f.id }}
              className="flex items-center justify-between py-3 text-sm hover:text-primary"
            >
              <span className="truncate pr-4">{f.title}</span>
              <span className="tabular-nums text-muted">{formatNumber(f.n)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
