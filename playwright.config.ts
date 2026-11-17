import { defineConfig, devices } from "@playwright/test";

/** Automated tests: real browsers clicking through the site, against a
 *  stand-in database (tests/mock/server.mjs) so nothing touches real data.
 *
 *    npm test            build-free run against `next dev`
 *    CI=1 npm test       what GitHub runs: production build, then the tests
 */
const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
// To use a Chrome already on this computer instead of Playwright's own,
// set CHROME_PATH (for example to /usr/bin/google-chrome).
const launchOptions = process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH, args: ["--no-proxy-server"] }
  : {};
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests",
  // Browser tests only; the database tests in tests/db run with node --test.
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: [
    {
      command: "node tests/mock/server.mjs",
      url: "http://127.0.0.1:54321/rest/v1/films",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: process.env.CI
        ? `node tests/mock/wait.mjs && npm run build && npx next start -p ${PORT}`
        : `npx next dev -p ${PORT}`,
      url: baseURL,
      env,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
