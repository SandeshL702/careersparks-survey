import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/forms/$formId")({ component: FormSection });

function FormSection() {
  const { formId } = useParams({ from: "/admin/forms/$formId" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { label: "Build", to: "/admin/forms/$formId" as const, extra: "" },
    { label: "Responses", to: "/admin/forms/$formId/responses" as const, extra: "/responses" },
    { label: "Analytics", to: "/admin/forms/$formId/analytics" as const, extra: "/analytics" },
  ];
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex gap-1 border-b border-border px-4">
        {items.map((tab) => {
          const path = `/admin/forms/${formId}${tab.extra}`;
          const active = tab.extra ? pathname.startsWith(path) : pathname === path || pathname === `${path}/`;
          return (
            <Link
              key={tab.label}
              to={tab.to}
              params={{ formId }}
              className={cn(
                "border-b-2 px-3 py-3 text-sm",
                active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
