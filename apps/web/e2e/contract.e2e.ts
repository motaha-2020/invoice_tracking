import { expect, test, type Page } from "@playwright/test";
import { as, ok } from "./helpers";

/** تعديل بيانات العقد ومرفقاته: الشئون الفنية تعدّل وترفع، والباقي يشوف وينزّل بس */
test.describe.configure({ mode: "serial" });

let url = "";
// اسم عربي زي الواقع (من buffer — Playwright مابيقراش مسارات بأسماء عربي من القرص بشكل موثوق)
const pdf = { name: "برقية القبول.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") };

async function openContract(page: Page) {
  if (!url) {
    await page.goto("/contracts");
    await page.locator('main a:has-text("DEMO-101/2025")').first().click();
    await page.waitForURL(/\/contracts\/[a-z0-9]+$/);
    url = new URL(page.url()).pathname;
  } else await page.goto(url);
  await expect(page.getByText("شروط العقد").first()).toBeVisible();
}

test("الشئون الفنية تعدّل بيانات العقد (مع التحقق من مجموع نسب السداد)", async ({ browser }) => {
  await as(browser, "tech.s1", async (page) => {
    await openContract(page);
    await page.click('button:has-text("تعديل بيانات العقد")');
    await page.fill("#ce-payMonthlyPct", "75");
    await page.click('dialog[open] button:has-text("حفظ التعديلات")');
    await expect(page.locator("dialog[open] [role=alert]").first()).toContainText("يجب أن يساوي 100%");
    await page.fill("#ce-payMonthlyPct", "70");
    await page.fill("#ce-warrantyMonths", "24");
    await ok(page, () => page.click('dialog[open] button:has-text("حفظ التعديلات")'), /تم حفظ بيانات العقد \(1 حقل\)/);
    await expect(page.locator("dd", { hasText: "24" }).filter({ hasText: "شهر" })).toBeVisible();
  });
});

test("الشئون الفنية ترفع برقية القبول — والملف قابل للتنزيل والحذف", async ({ browser }) => {
  await as(browser, "tech.s1", async (page) => {
    await openContract(page);
    await page.click('button:has-text("رفع ملفات")');
    await expect(page.getByText("يرجى اختيار نوع المستند أولاً")).toBeVisible();
    await page.selectOption('select[aria-label="نوع المستند"]', "award_letter");
    await page.fill('input[aria-label="ملاحظة"]', "برقية رقم 123");
    await ok(page, () => page.setInputFiles('input[aria-label="ملفات العقد"]', pdf), /تم رفع الملف/);
    const row = page.locator("li", { hasText: "برقية القبول.pdf" });
    await expect(row).toContainText("برقية القبول");
    await expect(row).toContainText("برقية رقم 123");
    const res = await page.request.get((await row.locator("a").first().getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
  });
});

test("PMO يرى المرفقات وينزّلها بدون أزرار تعديل، ومقاول آخر لا يصل للعقد", async ({ browser }) => {
  let href = "";
  await as(browser, "pmo", async (page) => {
    await openContract(page);
    await expect(page.locator('button:has-text("تعديل بيانات العقد")')).toHaveCount(0);
    await expect(page.locator('button:has-text("رفع ملفات")')).toHaveCount(0);
    href = (await page.locator('li:has-text("برقية القبول.pdf") a').first().getAttribute("href"))!;
    expect((await page.request.get(href)).status()).toBe(200);
    expect((await page.request.delete(href)).status()).toBe(403);
  });
  await as(browser, "co2", async (page) => {
    expect((await page.request.get(href)).status()).toBe(404);
  });
});

test("الشئون الفنية تحذف المرفق وتعيد الضمان الفني", async ({ browser }) => {
  await as(browser, "tech.s1", async (page) => {
    await openContract(page);
    page.once("dialog", (d) => d.accept());
    await ok(page, () => page.click('li:has-text("برقية القبول.pdf") button[aria-label^="حذف"]'), /تم حذف الملف/);
    await expect(page.getByText("لا توجد مرفقات للعقد بعد")).toBeVisible();
    await page.click('button:has-text("تعديل بيانات العقد")');
    await page.fill("#ce-warrantyMonths", "12");
    await ok(page, () => page.click('dialog[open] button:has-text("حفظ التعديلات")'), /تم حفظ/);
  });
});
