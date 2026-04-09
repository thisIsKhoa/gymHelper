import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { apiRequest } from "../../lib/api.ts";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let isCancelled = false;

    async function verifySession() {
      try {
        await apiRequest("/auth/me", "GET");
        if (!isCancelled) {
          setStatus("authenticated");
        }
      } catch {
        if (!isCancelled) {
          setStatus("unauthenticated");
        }
      }
    }

    void verifySession();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <p className="px-4 py-6 text-sm text-[var(--muted)]">
        Checking authentication...
      </p>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
