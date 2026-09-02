import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/spark-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/install")({
  component: InstallPage,
});

function InstallPage() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("Sandesh");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onInstall(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          name: adminName,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; email?: string };
      if (!res.ok) throw new Error(payload.message || `Install failed (${res.status})`);
      await navigate({ to: "/login" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Install failed.";
      setError(
        /failed to fetch|networkerror|load failed/i.test(raw)
          ? "Server timeout. 10 second wait karke Install dobara dabao."
          : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="grain" />
      <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold">Create admin login</h1>
        <p className="mt-2 text-sm text-muted">
          Sirf ek baar. Database already connected hai — yahan apna email aur password set karo. Phir isse login
          hoga.
        </p>
        <form onSubmit={(e) => void onInstall(e)} className="mt-8 space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div>
              <Label>Your name</Label>
              <Input className="mt-1" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
            </div>
            <div className="mt-4">
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
            <div className="mt-4">
              <Label>Password (min 8)</Label>
              <Input
                className="mt-1"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>
          </section>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create admin"}
          </Button>
        </form>
      </main>
    </div>
  );
}
