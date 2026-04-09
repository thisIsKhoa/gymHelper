import { LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  cardCount?: number;
}

export function LoadingState({
  message = "Loading data...",
  cardCount = 3,
}: LoadingStateProps) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="ui-chip inline-flex items-center gap-2 px-3 py-2 text-sm">
        <LoaderCircle size={16} className="animate-spin text-[var(--accent)]" />
        {message}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.max(1, cardCount) }).map((_, index) => (
          <div
            key={index}
            className="glass-card ui-soft-shadow space-y-3 overflow-hidden p-4"
            aria-hidden="true"
          >
            <div className="h-2.5 w-20 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-7 w-2/3 animate-pulse rounded-lg bg-[color-mix(in_oklab,var(--border)_78%,transparent)]" />
            <div className="h-2.5 w-full animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-[var(--border)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
