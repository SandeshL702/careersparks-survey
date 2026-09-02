import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/spark-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInstallState, runInstall } from "@/lib/survey/install.server";

export const Route = createFileRoute("/install")({
  loader: async () => getInstallState(),
  component: InstallPage,
});

function InstallPage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const needsDb = initial.status === "needs_install";
  const [dbHost, setDbHost] = useState(initial.status === "ready" ? "localhost" : initial.dbHost);
  const [dbPort, setDbPort] = useState(initial.status === "needs_install" ? initial.dbPort : "3306");
  const [dbUser, setDbUser] = useState(initial.status === "needs_install" ? initial.dbUser : "");
  const [dbPassword, setDbPassword] = useState("");
  const [dbName, setDbName] = useState(
    initial.status === "needs_install" ? initial.dbName : initial.status === "needs_admin" ? initial.dbName : "",
  );
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("CareerSparks Admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onInstall(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await runInstall({
        data: {
          dbHost,
          dbPort,
          dbUser,
          dbPassword,
          dbName,
          adminEmail,
          adminPassword,
          adminName,
          siteUrl: origin,
        },
      });
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setBusy(false);
    }
  }

  if (initial.status === "ready") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <Logo />
        <p className="mt-6 text-sm text-muted">Already installed.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="grain" />
      <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold">Install CareerSparks</h1>
        <p className="mt-2 text-sm text-muted">
          One click. Tables, admin account, and Job Requirement Form ban jayenge.
        </p>
        <form onSubmit={(e) => void onInstall(e)} className="mt-8 space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">1. Hostinger MySQL</h2>
            <p className="mt-1 text-xs text-muted">hPanel → Databases → MySQL se copy karo.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Database host</Label>
                <Input className="mt-1" value={dbHost} onChange={(e) => setDbHost(e.target.value)} required />
              </div>
              <div>
                <Label>Port</Label>
                <Input className="mt-1" value={dbPort} onChange={(e) => setDbPort(e.target.value)} />
              </div>
              <div>
                <Label>Database name</Label>
                <Input className="mt-1" value={dbName} onChange={(e) => setDbName(e.target.value)} required />
              </div>
              <div>
                <Label>Username</Label>
                <Input className="mt-1" value={dbUser} onChange={(e) => setDbUser(e.target.value)} required />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  required={needsDb}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">2. Admin login</h2>
            <p className="mt-1 text-xs text-muted">Yahi se tum dashboard khologe. Website pe nahi dikhega.</p>
            <div className="mt-4 grid gap-3">
              <div>
                <Label>Your name</Label>
                <Input className="mt-1" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Password (min 8)</Label>
                <Input
                  className="mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
          </section>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" size="lg" className="min-h-12 w-full" disabled={busy}>
            {busy ? "Installing…" : "Install CareerSparks"}
          </Button>
        </form>
      </main>
    </div>
  );
}
