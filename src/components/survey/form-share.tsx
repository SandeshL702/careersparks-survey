import { useState } from "react";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formPublicUrl(slug: string) {
  if (typeof window === "undefined") return `/f/${slug}`;
  return `${window.location.origin}/f/${slug}`;
}

export function FormQr({ url, size = 148 }: { url: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&margin=8&data=${encodeURIComponent(url)}`;
  return (
    <img
      src={src}
      alt={`QR code for ${url}`}
      width={size}
      height={size}
      className="rounded-lg bg-fg p-1.5"
    />
  );
}

export function FormShare({
  slug,
  message,
  compact,
}: {
  slug: string;
  message?: string;
  compact?: boolean;
}) {
  const url = formPublicUrl(slug);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${message || "Fill this CareerSparks form:"} ${url}`)}`;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code className="max-w-[180px] truncate rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
          /f/{slug}
        </code>
        <Button type="button" size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 text-xs text-primary">
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center")}>
      <FormQr url={url} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted">
          <Link2 className="size-3.5" /> Form link
        </p>
        <p className="mt-1 break-all font-mono text-sm text-fg">{url}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
