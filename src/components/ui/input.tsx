import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
