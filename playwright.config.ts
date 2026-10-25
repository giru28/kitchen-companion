import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/tmp/lifeos-browsers";
const subpath = process.env.KITCHEN_TEST_SUBPATH === "1";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  use: {
    actionTimeout: 10000,
    baseURL: `http://127.0.0.1:3300/${subpath ? "kitchen/" : ""}`,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.KITCHEN_CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: {
    command: subpath ? "npm run preview -- --base /kitchen/" : "npm run preview",
    url: `http://127.0.0.1:3300/${subpath ? "kitchen/" : ""}`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
