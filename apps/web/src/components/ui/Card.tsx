import clsx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function Card({
  title,
  subtitle,
  action,
  className,
  children,
}: CardProps) {
  return (
    <section className={clsx("glass-card p-5 md:p-6", className)}>
      {(title || subtitle || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
