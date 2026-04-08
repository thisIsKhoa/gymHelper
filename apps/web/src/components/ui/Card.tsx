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
    <section className={clsx("glass-card p-4 sm:p-5 md:p-6", className)}>
      {(title || subtitle || action) && (
        <header className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-base font-semibold text-[var(--text)] sm:text-lg">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="w-full sm:w-auto">{action}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
