import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMailSettings, listOutbox, saveMailSettings, sendTestMail } from "@/lib/survey/api";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type MailForm = Awaited<ReturnType<typeof getMailSettings>>;
type OutboxRow = Awaited<ReturnType<typeof listOutbox>>[number];

function SettingsPage() {
  const [mail, setMail] = useState<MailForm | null>(null);
  const [outbox, setOutbox] = useState<OutboxRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function reload() {
    const [m, o] = await Promise.all([getMailSettings(), listOutbox()]);
    setMail(m);
    setOutbox(o);
    if (m.notifyEmail) setTestTo(m.notifyEmail);
  }

  useEffect(() => {
    reload().catch(() => {
      setMail(null);
      setOutbox([]);
    });
  }, []);

  async function save() {
    if (!mail) return;
    setSaving(true);
    try {
      await saveMailSettings({ data: mail });
      toast.success("Email settings saved");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    try {
      const res = await sendTestMail({ data: { to: testTo || mail?.notifyEmail || mail?.smtpFrom || "" } });
      toast.success(res.status === "sent" ? "Test email sent" : res.status === "preview" ? "Queued in outbox (SMTP not set yet)" : "Saved with an error — check outbox");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  }

  function patch<K extends keyof MailForm>(key: K, value: MailForm[K]) {
    setMail((m) => (m ? { ...m, [key]: value } : m));
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Automated thank-you emails and admin alerts. Use your Hostinger mailbox SMTP. Until SMTP is saved, emails
          still land in the outbox so you can see the automation.
        </p>
      </div>

      {mail ? (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">SMTP (Hostinger email)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Host</Label>
              <Input className="mt-1" value={mail.smtpHost} onChange={(e) => patch("smtpHost", e.target.value)} />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                className="mt-1"
                type="number"
                value={mail.smtpPort}
                onChange={(e) => patch("smtpPort", Number(e.target.value) || 465)}
              />
            </div>
            <div>
              <Label>SMTP username</Label>
              <Input className="mt-1" value={mail.smtpUser} onChange={(e) => patch("smtpUser", e.target.value)} />
            </div>
            <div>
              <Label>SMTP password</Label>
              <Input
                className="mt-1"
                type="password"
                value={mail.smtpPass}
                onChange={(e) => patch("smtpPass", e.target.value)}
                placeholder="Leave unchanged to keep"
              />
            </div>
            <div>
              <Label>From email</Label>
              <Input className="mt-1" value={mail.smtpFrom} onChange={(e) => patch("smtpFrom", e.target.value)} />
            </div>
            <div>
              <Label>Admin notify email</Label>
              <Input className="mt-1" value={mail.notifyEmail} onChange={(e) => patch("notifyEmail", e.target.value)} />
            </div>
          </div>
          <h2 className="pt-2 font-display text-lg font-semibold">Templates</h2>
          <p className="text-xs text-muted">Variables: {"{{name}} {{form}} {{email}} {{phone}} {{score}} {{score_line}} {{source}}"}</p>
          <div>
            <Label>Thank-you subject</Label>
            <Input className="mt-1" value={mail.thankYouSubject} onChange={(e) => patch("thankYouSubject", e.target.value)} />
          </div>
          <div>
            <Label>Thank-you body</Label>
            <Textarea className="mt-1 min-h-32" value={mail.thankYouBody} onChange={(e) => patch("thankYouBody", e.target.value)} />
          </div>
          <div>
            <Label>Admin alert subject</Label>
            <Input className="mt-1" value={mail.notifySubject} onChange={(e) => patch("notifySubject", e.target.value)} />
          </div>
          <div>
            <Label>Admin alert body</Label>
            <Textarea className="mt-1 min-h-32" value={mail.notifyBody} onChange={(e) => patch("notifyBody", e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Label>Send test to</Label>
              <Input className="mt-1" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={() => void test()}>
              Send test
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Hostinger mailbox: host <span className="text-fg">smtp.hostinger.com</span>, port 465, username = full email.
          </p>
          <Link to="/admin/team" className="inline-block text-sm text-primary">
            Manage team →
          </Link>
        </Card>
      ) : (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      )}

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Staff password</h2>
        <p className="text-sm text-muted">Change the admin password after first login.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Current password</Label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void authClient
              .changePassword({ currentPassword, newPassword })
              .then((res) => {
                if (res.error) throw new Error(res.error.message || "Could not change password");
                setCurrentPassword("");
                setNewPassword("");
                toast.success("Password updated");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not change password"));
          }}
          disabled={currentPassword.length < 8 || newPassword.length < 8}
        >
          Update password
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Email outbox</h2>
        <p className="mt-1 text-sm text-muted">Every automated email is logged here.</p>
        <div className="mt-4 divide-y divide-border">
          {outbox == null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : outbox.length === 0 ? (
            <p className="text-sm text-muted">No emails yet. Submit a form to see thank-you automation.</p>
          ) : (
            outbox.map((row) => (
              <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{row.subject}</p>
                  <p className="text-xs text-muted">
                    {row.kind} · {row.to}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-muted">{row.status}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
