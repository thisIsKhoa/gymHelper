import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useApplyTheme } from "../stores/theme-store.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  useApplyTheme();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
