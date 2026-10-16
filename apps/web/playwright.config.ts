import { defineConfig, devices } from "@playwright/test";

/**
 * اختبارات شاملة (end-to-end) لرحلة المستخلص على البيانات التجريبية.
 * المتطلبات: قاعدة بيانات عليها migrate + seed بـ SEED_DEMO=1، و`next build` قبل التشغيل.
 * التشغيل:  npm run e2e -w @it/web
 * - E2E_BASE_URL: لو السيرفر شغال بالفعل (مثلاً next dev) — ساعتها مش بيشغّل سيرفر.
 * - E2E_CHROMIUM: مسار Chromium جاهز بدل `playwright install`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    viewport: { width: 1400, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
      },
});
