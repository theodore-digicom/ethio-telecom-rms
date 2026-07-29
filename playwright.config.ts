import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3055",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next dev -p 3055",
    url: "http://localhost:3055/api/health",
    reuseExistingServer: !process.env.CI,
  },
});
