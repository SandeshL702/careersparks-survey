import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { HourBars, OptionBars, ResponsesLine, ScoreBars, SourcePie } from "@/components/survey/charts";
import { getFormAnalytics } from "@/lib/survey/api";
import { formatDuration, formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/admin/forms/$formId/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const { formId } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof getFormAnalytics>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFormAnalytics({ data: { formId } })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, [formId]);

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!data) return <div className="h-80 animate-pulse bg-surface" />;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Insights</p>
        <h2 className="font-display text-2xl font-semibold">{data.form.title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Views", value: formatNumber(data.views) },
          { label: "Starts", value: formatNumber(data.starts) },
          { label: "Completed", value: formatNumber(data.completes) },
          { label: "Completion", value: `${data.completion}%` },
          { label: "Unique people", value: formatNumber(data.uniqueRespondents) },
          { label: "Avg time", value: formatDuration(data.avgDurationMs) },
          { label: "Drop-off at start", value: `${data.dropOffStart}%` },
          { label: "Drop-off at submit", value: `${data.dropOffSubmit}%` },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{k.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{k.value}</p>
          </Card>
        ))}
      </div>
      {data.weakestQuestion ? (
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Watch this question</p>
          <p className="mt-2 font-display text-lg font-semibold">{data.weakestQuestion.title}</p>
          <p className="mt-1 text-sm text-muted">{data.weakestQuestion.skipRate}% of people skipped it.</p>
        </Card>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-display font-semibold">Responses over time</h3>
          <ResponsesLine data={data.daily} />
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-semibold">Source mix</h3>
          <SourcePie data={data.sources} />
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-semibold">Hour of day</h3>
          <HourBars data={data.hours} />
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-semibold">Weekday</h3>
          <OptionBars data={data.weekdays.map((w) => ({ label: w.day, n: w.n }))} />
        </Card>
        <Card>
          <h3 className="mb-1 font-display font-semibold">Time to complete</h3>
          <ScoreBars data={data.durationBuckets} />
        </Card>
        <Card>
          <h3 className="mb-1 font-display font-semibold">Score bands</h3>
          <p className="mb-2 text-sm text-muted">
            {data.avgScore != null ? `Avg score ${Math.round(data.avgScore * 10) / 10}` : "No quiz scores"}
          </p>
          <ScoreBars data={data.scoreBuckets} />
        </Card>
        <Card>
          <h3 className="mb-3 font-display font-semibold">Funnel</h3>
          <ul className="space-y-3">
            {[
              { label: "Viewed", n: data.views },
              { label: "Started", n: data.starts },
              { label: "Submitted", n: data.completes },
            ].map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums text-muted">{formatNumber(row.n)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${data.views ? Math.min(100, (row.n / data.views) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.breakdown
          .filter((b) => b.options.length > 0 || b.average != null)
          .map((b) => (
            <Card key={b.id}>
              <h3 className="mb-1 font-display text-base font-semibold">{b.title}</h3>
              <p className="mb-2 text-xs text-muted">
                {b.answers} answers · {b.skipRate}% skipped
                {b.average != null ? ` · avg ${b.average}` : ""}
              </p>
              {b.options.length ? <OptionBars data={b.options} /> : null}
            </Card>
          ))}
      </div>
    </div>
  );
}
