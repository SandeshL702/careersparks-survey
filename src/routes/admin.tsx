import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AdminShell } from "@/components/layout/admin-shell";
import { getDashboardStats } from "@/lib/survey/api";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function hasPreviewBearer() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage.getItem("grok-auth.bearer-token"));
  } catch {
    return false;
  }
}

function AdminLayout() {
  const { user, isPending } = useCurrentUserState();
  const [waited, setWaited] = useState(false);
  const [staff, setStaff] = useState<"unk" | "yes" | "no">("unk");

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), hasPreviewBearer() ? 8000 : 4000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    getDashboardStats()
      .then(() => setStaff("yes"))
      .catch(() => setStaff("no"));
  }, [user?.id]);

  if ((isPending || (hasPreviewBearer() && !user) || (user && staff === "unk")) && !waited) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-10 w-48 animate-pulse rounded-md bg-surface" />
          <p className="mt-3 text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (staff === "no") {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="font-display text-xl font-semibold">Staff only</p>
          <p className="mt-2 text-sm text-muted">This Google account can fill forms, not open the desk.</p>
          <Link to="/" className="mt-6 inline-block text-sm text-primary">
            Back to forms
          </Link>
        </div>
      </div>
    );
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
