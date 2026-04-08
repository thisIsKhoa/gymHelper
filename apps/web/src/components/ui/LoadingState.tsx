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
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
        <LoaderCircle size={16} className="animate-spin text-[var(--accent)]" />
        {message}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.max(1, cardCount) }).map((_, index) => (
          <div
            key={index}
            className="glass-card space-y-3 p-4"
            aria-hidden="true"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-8 w-2/3 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
