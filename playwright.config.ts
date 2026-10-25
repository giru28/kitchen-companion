import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/tmp/lifeos-browsers";
const subpath = process.env.KITCHEN_TEST_SUBPATH === "1";
const publishedURL = process.env.KITCHEN_TEST_URL;
if (publishedURL) {
  const url = new URL(publishedURL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "KITCHEN_TEST_URLは認証情報・クエリ・ハッシュのないHTTPS URLで指定してください。",
    );
}
const baseURL = publishedURL
  ? publishedURL.replace(/\/?$/, "/")
  : `http://127.0.0.1:3300/${subpath ? "kitchen/" : ""}`;
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  use: {
    actionTimeout: 10000,
    baseURL,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.KITCHEN_CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: publishedURL
    ? undefined
    : {
        command: subpath
          ? "npm run preview -- --base /kitchen/"
          : "npm run preview",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30000,
      },
});
