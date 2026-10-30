import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "e2e/**/*.spec.ts",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: {
      // Canvas anti-aliasing differs slightly between runs; allow a tiny diff.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  // Visual baselines are per browser and per OS (CI runs on Linux).
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "Asia/Seoul",
    // The production build registers a PWA service worker; block it so every
    // test starts from the network and page.route sees all requests.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Desktop projects run everything except mobile-only tests. The mobile
  // project runs tests tagged @mobile (shared) or @mobile-only, since the
  // phone layout moves the toolbar and hides the properties panel.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@mobile-only/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grepInvert: /@mobile-only/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      grepInvert: /@mobile-only/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    // Serves the production build created by `npm run setup:app`.
    command: `npx vite preview --port ${PORT} --strictPort`,
    cwd: "./app/excalidraw-app",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
