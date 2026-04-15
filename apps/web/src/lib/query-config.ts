export const QUERY_STALE_MS = {
  short: 30_000,
  medium: 3 * 60 * 1000,
  long: 10 * 60 * 1000,
} as const;

export const QUERY_GC_MS = {
  short: 5 * 60 * 1000,
  medium: 30 * 60 * 1000,
  long: 60 * 60 * 1000,
} as const;
