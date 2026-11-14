import { defineConfig } from "@playwright/test";

/**
 * E2E tests run against a running stack (db + ai-service + `npm run dev`).
 * globalSetup reseeds the demo data so every run starts from the same state.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "ar-EG",
    screenshot: "only-on-failure",
  },
});
