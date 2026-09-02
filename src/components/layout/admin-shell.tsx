import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, Inbox, LayoutDashboard, Settings } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { Logo } from "@/components/brand/spark-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/forms", label: "Forms", icon: FileText },
  { to: "/admin/inbox", label: "Inbox", icon: Inbox },
  { to: "/admin/templates", label: "Templates", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-dvh overflow-hidden bg-bg lg:flex-row">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-lg px-3 text-sm",
                  active ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <UserButton />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <Link to="/">
            <Logo markClassName="size-6" />
          </Link>
          <UserButton />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
