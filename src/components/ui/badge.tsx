import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "primary" | "success" | "danger";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "primary" && "bg-primary text-primary-fg",
        tone === "muted" && "bg-surface-2 text-muted",
        tone === "success" && "bg-success/15 text-success",
        tone === "danger" && "bg-danger/15 text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}
