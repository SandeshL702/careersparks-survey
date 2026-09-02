import { cn } from "@/lib/utils";

export function SparkMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("text-primary", animated && "spark-mark", className)}
    >
      <path
        d="M26.5 4.5 11 26h11.2L19.5 43.5 37 22H25.4L26.5 4.5Z"
        className={cn(animated && "spark-path")}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SparkMark className={cn("size-7", markClassName)} />
      <span className="font-display text-lg font-semibold tracking-tight">
        CareerSparks
        <span className="font-sans text-sm font-medium text-muted"> Survey</span>
      </span>
    </span>
  );
}
