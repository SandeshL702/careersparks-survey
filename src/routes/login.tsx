import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { authClient, authEnabled } from "@/lib/auth/client";
import { SparkMark } from "@/components/brand/spark-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareWorkspace, getDashboardStats } from "@/lib/survey/api";
import { getInstallState } from "@/lib/survey/install";

export const Route = createFileRoute("/login")({
  loader: async () => {
    const state = await getInstallState();
    if (state.status !== "ready") throw redirect({ to: "/install" });
    return null;
  },
  component: Login,
});

const BEARER_KEY = "grok-auth.bearer-token";

function savePreviewBearer(token: string | null | undefined) {
  if (!token) return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

function tokenFromResult(res: {
  data?: { token?: string | null } | null;
  response?: Response;
}) {
  return res.response?.headers.get("set-auth-token") || res.data?.token || null;
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void prepareWorkspace();
    void authClient.getSession().then(async (session) => {
      if (!session.data?.user) return;
      try {
        await getDashboardStats();
        await navigate({ to: "/admin" });
      } catch {
        /* Google respondents are not staff */
      }
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await authClient.signIn.email(
        { email, password },
        {
          onSuccess: (ctx: { response: Response }) => {
            savePreviewBearer(ctx.response.headers.get("set-auth-token"));
          },
        },
      );
      if (res.error) throw new Error(res.error.message || "Could not sign in");
      savePreviewBearer(tokenFromResult(res));
      await authClient.getSession();
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setPending(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="grain" />
      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <SparkMark className="size-8" animated />
          <span className="font-display text-lg font-semibold">CareerSparks</span>
        </Link>
        <h1 className="font-display text-3xl font-semibold">Staff sign in</h1>
        <p className="mt-2 text-sm text-muted">Username and password only.</p>
        {authEnabled ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                className="mt-1"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                className="mt-1"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
