import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "dot" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev --workspace @gymhelper/api",
      cwd: "../..",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "npm run dev --workspace apps/web",
      cwd: "../..",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
