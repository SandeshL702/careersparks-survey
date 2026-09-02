import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { getWorkspace, setMemberRole } from "@/lib/survey/api";
import type { MemberRole } from "@/lib/survey/types";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin/team")({ component: TeamPage });

function TeamPage() {
  const me = useCurrentUser();
  const [data, setData] = useState<Awaited<ReturnType<typeof getWorkspace>> | null>(null);

  useEffect(() => {
    getWorkspace().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <div className="h-64 animate-pulse bg-surface" />;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Access</p>
        <h1 className="font-display text-3xl font-semibold">Team</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          First person to sign in becomes owner. Later accounts join as recruiters. Owners can change roles.
        </p>
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {data.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{m.email || m.userId}</p>
                {m.userId === me?.id ? <p className="text-xs text-muted">You</p> : null}
              </div>
              {data.role === "owner" && m.userId !== me?.id ? (
                <select
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                  value={m.role}
                  onChange={async (e) => {
                    try {
                      await setMemberRole({ data: { userId: m.userId, role: e.target.value as MemberRole } });
                      toast.success("Role updated");
                      setData(await getWorkspace());
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <option value="owner">Owner</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="text-sm capitalize text-muted">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
