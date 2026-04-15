import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";

import { SuccessToastProvider } from "../components/ui/success-toast.tsx";
import {
  getApiCacheDiagnostics,
  invalidateApiCache,
  resetApiCacheDiagnostics,
} from "../lib/api.ts";
import { QUERY_GC_MS, QUERY_STALE_MS } from "../lib/query-config.ts";
import { useApplyTheme } from "../stores/theme-store.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_MS.short,
      gcTime: QUERY_GC_MS.medium,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function getReactQueryDiagnostics() {
  const queries = queryClient.getQueryCache().getAll();

  const activeQueries = queries.filter((query) => query.isActive()).length;
  const staleQueries = queries.filter((query) => query.isStale()).length;

  return {
    totalQueries: queries.length,
    activeQueries,
    staleQueries,
    freshQueries: queries.length - staleQueries,
    fetchingQueries: queryClient.isFetching(),
    mutatingQueries: queryClient.isMutating(),
  };
}

export function AppProviders({ children }: PropsWithChildren) {
  useApplyTheme();

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }

    const host = window as Window & {
      __GYMHELPER_PERF__?: {
        api: {
          getDiagnostics: typeof getApiCacheDiagnostics;
          resetDiagnostics: typeof resetApiCacheDiagnostics;
          clearCache: () => void;
        };
        reactQuery: {
          getDiagnostics: typeof getReactQueryDiagnostics;
          invalidateAll: () => Promise<void>;
          clearCache: () => void;
        };
        clearAllCaches: () => Promise<void>;
      };
    };

    host.__GYMHELPER_PERF__ = {
      api: {
        getDiagnostics: getApiCacheDiagnostics,
        resetDiagnostics: resetApiCacheDiagnostics,
        clearCache: () => invalidateApiCache(["*"]),
      },
      reactQuery: {
        getDiagnostics: getReactQueryDiagnostics,
        invalidateAll: async () => {
          await queryClient.invalidateQueries();
        },
        clearCache: () => queryClient.clear(),
      },
      clearAllCaches: async () => {
        invalidateApiCache(["*"]);
        queryClient.clear();
        resetApiCacheDiagnostics();
      },
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuccessToastProvider>{children}</SuccessToastProvider>
    </QueryClientProvider>
  );
}
