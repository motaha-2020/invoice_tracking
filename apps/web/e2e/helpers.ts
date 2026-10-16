import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** كلمة سر المستخدمين التجريبيين (SEED_DEMO_PASSWORD وقت الـ seed) */
export const PASSWORD = process.env.E2E_PASSWORD ?? "demo-password-123";
export const user = (name: string) => `${name}@example.test`;

/**
 * يفتح جلسة مستقلة (cookies منفصلة) باسم مستخدم تجريبي ويقفلها بعد الخطوة.
 * أي خطأ JavaScript في الصفحة بيفشّل الاختبار.
 */
export async function as(browser: Browser, name: string, fn: (page: Page) => Promise<void>): Promise<void> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/login");
    await page.fill("input[name=email]", user(name));
    await page.fill("input[name=password]", PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { waitUntil: "commit" }),
      page.click("button[type=submit]"),
    ]);
    await fn(page);
    expect(errors, `أخطاء JavaScript في الصفحة (${name})`).toEqual([]);
  } finally {
    await ctx.close();
  }
}

export const bar = (page: Page, text: string) => page.locator('[aria-label="إجراءات المستخلص"] button', { hasText: text });
export const modalBtn = (page: Page, text: string) => page.locator("dialog[open] button", { hasText: text });

/** ينفّذ إجراء وينتظر رسالة التأكيد الجديدة (toast) — ويرجع نوعها ونصها */
export async function act(page: Page, fn: () => Promise<void>): Promise<{ kind: string; text: string }> {
  const ids = await page.locator("[data-toast-id]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-toast-id"))));
  const last = Math.max(0, ...ids);
  await fn();
  const h = await page.waitForFunction((n) => {
    const t = [...document.querySelectorAll("[data-toast-id]")].find((e) => Number(e.getAttribute("data-toast-id")) > n);
    return t ? { kind: t.getAttribute("data-kind") ?? "", text: (t.textContent ?? "").trim() } : null;
  }, last);
  const r = (await h.jsonValue()) as { kind: string; text: string };
  // الإجراءات بتعمل refresh للصفحة بعد الرسالة — نستنى الشبكة تهدى قبل الخطوة الجاية
  await page.waitForLoadState("networkidle").catch(() => {});
  return r;
}

/** إجراء لازم ينجح */
export async function ok(page: Page, fn: () => Promise<void>, contains?: string | RegExp): Promise<string> {
  const r = await act(page, fn);
  expect(r.kind, r.text).toBe("ok");
  if (contains) expect(r.text).toMatch(contains);
  return r.text;
}

export async function openInvoice(page: Page, url: string, tab?: string): Promise<void> {
  await page.goto(tab ? `${url}?tab=${tab}` : url);
  await expect(page.getByText("مسار المستخلص").first()).toBeVisible();
}

/** "لدى: ..." في رأس صفحة المستخلص */
export async function holder(page: Page): Promise<string> {
  const t = await page.getByText(/^لدى: /).first().textContent();
  return (t ?? "").replace(/^لدى:\s*/, "").trim();
}

export async function expectHolder(page: Page, url: string, expected: string | RegExp): Promise<void> {
  await openInvoice(page, url);
  await expect(page.getByText(/^لدى: /).first()).toHaveText(typeof expected === "string" ? `لدى: ${expected}` : expected);
}

export async function approve(page: Page): Promise<string> {
  await bar(page, "اعتماد وإحالة").click();
  return ok(page, () => modalBtn(page, "اعتماد وإحالة").click(), /أُحيل|تم/);
}

export async function selectByLabelPrefix(select: Locator, prefix: string): Promise<string> {
  const labels = await select.locator("option").allTextContents();
  const i = labels.findIndex((t) => t.trim().startsWith(prefix));
  expect(i, `الخيار ${prefix}`).toBeGreaterThan(-1);
  await select.selectOption({ index: i });
  return select.inputValue();
}

// ─────────── ملفات الاختبار: من قوالب الاستيراد الرسمية في templates/ ───────────

export type Fixtures = { lines: string; lines2: string; mats: string; pdf: string };

const TEMPLATES = path.resolve(__dirname, "../../../templates");

async function fillTemplate(src: string, dst: string, sheet: string, rows: (string | number)[][]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(TEMPLATES, src));
  const ws = wb.getWorksheet(sheet);
  if (!ws) throw new Error(`الشيت ${sheet} مش موجود في ${src}`);
  for (let r = 3; r <= Math.max(ws.rowCount, 6); r++) ws.getRow(r).values = [];
  rows.forEach((v, i) => {
    ws.getRow(3 + i).values = v;
  });
  await wb.xlsx.writeFile(dst);
}

export async function makeFixtures(): Promise<Fixtures> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "it-e2e-"));
  const f: Fixtures = {
    lines: path.join(dir, "lines.xlsx"),
    lines2: path.join(dir, "lines2.xlsx"),
    mats: path.join(dir, "mats.xlsx"),
    pdf: path.join(dir, "doc.pdf"),
  };
  // بنود فيها: كود بنقط (1.9.1)، بند مش في المقايسة (9-9-9)، وكمية مش رقم — عشان نختبر التحقق
  await fillTemplate("09_بنود_المستخلص.xlsx", f.lines, "بنود المستخلص", [
    ["1-1-1-1", "", "", 2, "", ""],
    ["1.9.1", "", "", 1500, "", ""],
    ["4-2-1", "", "", 1700, "", ""],
    ["9-9-9", "", "", 1, "", ""],
    ["2-6-1", "", "", "abc", "", ""],
  ]);
  await fillTemplate("09_بنود_المستخلص.xlsx", f.lines2, "بنود المستخلص", [
    ["1-1-1-1", "", "", 2, "", ""],
    ["1-9-1", "", "", 1400, "", ""],
  ]);
  await fillTemplate("10_مهمات_المستخلص.xlsx", f.mats, "مهمات المستخلص", [
    ["2.1.1", "", "", 900, ""],
    ["4.1.1", "", "", 50, ""],
  ]);
  fs.writeFileSync(f.pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  return f;
}
