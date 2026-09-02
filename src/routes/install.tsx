import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/spark-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInstallState, runInstall } from "@/lib/survey/install";
import { authClient } from "@/lib/auth/client";
import { prepareWorkspace } from "@/lib/survey/api";

export const Route = createFileRoute("/install")({
  loader: async () => {
    try {
      return await getInstallState();
    } catch {
      return {
        status: "needs_install" as const,
        dbHost: "localhost",
        dbPort: "3306",
        dbUser: "",
        dbName: "",
      };
    }
  },
  component: InstallPage,
});

function InstallPage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const [databaseUrl, setDatabaseUrl] = useState("");
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
          databaseUrl,
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
      const signed = await authClient.signUp.email({
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      });
      if (signed.error && !/exist|already/i.test(signed.error.message || "")) {
        throw new Error(signed.error.message || "Could not create admin login.");
      }
      await prepareWorkspace();
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
            <h2 className="text-sm font-semibold">1. Database</h2>
            <p className="mt-1 text-xs text-muted">
              Supabase → Project Settings → Database → Connection string (URI). Password wala URI paste karo.
            </p>
            <div className="mt-4">
              <Label>Supabase / Postgres URL</Label>
              <Input
                className="mt-1 font-mono text-xs"
                placeholder="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres"
                value={databaseUrl}
                onChange={(e) => setDatabaseUrl(e.target.value)}
              />
            </div>
            <p className="mt-4 text-xs text-muted">Ya Hostinger MySQL (optional):</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Database host</Label>
                <Input className="mt-1" value={dbHost} onChange={(e) => setDbHost(e.target.value)} />
              </div>
              <div>
                <Label>Port</Label>
                <Input className="mt-1" value={dbPort} onChange={(e) => setDbPort(e.target.value)} />
              </div>
              <div>
                <Label>Database name</Label>
                <Input className="mt-1" value={dbName} onChange={(e) => setDbName(e.target.value)} />
              </div>
              <div>
                <Label>Username</Label>
                <Input className="mt-1" value={dbUser} onChange={(e) => setDbUser(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
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
