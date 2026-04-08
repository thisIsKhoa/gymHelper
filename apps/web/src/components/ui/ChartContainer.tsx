import { useEffect, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  className?: string;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
}

export function ChartContainer({
  className,
  minWidth,
  minHeight,
  children,
}: ChartContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const updateReadyState = () => {
      const rect = host.getBoundingClientRect();
      setIsReady(rect.width > 1 && rect.height > 1);
    };

    updateReadyState();

    const observer = new ResizeObserver(() => {
      updateReadyState();
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={hostRef} className={`min-w-0 overflow-hidden ${className ?? ""}`}>
      {isReady ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={minWidth}
          minHeight={minHeight}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );
}
