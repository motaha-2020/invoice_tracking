import { expect, test } from "@playwright/test";
import {
  act,
  approve,
  as,
  bar,
  expectHolder,
  holder,
  makeFixtures,
  modalBtn,
  ok,
  openInvoice,
  selectByLabelPrefix,
  type Fixtures,
} from "./helpers";

/**
 * رحلة مستخلص كاملة على البيانات التجريبية (SEED_DEMO=1):
 * تقديم المقاول ← مشرف التنفيذ (تعديل كمية) ← مدير التنفيذ (الفئة) ← المدير العام (إعادة للاستيفاء)
 * ← المقاول (استبدال البنود وإعادة التقديم) ← ... ← الإدارة المالية (غرامة، قفل الارتباط، السداد) ← صرف المحتجز
 * ← التقارير والتصدير ← حدود الصلاحيات.
 * الخطوات متتابعة ومعتمدة على بعض (serial).
 */
test.describe.configure({ mode: "serial" });

/** الجهة الظاهرة في "لدى:" ← المستخدم التجريبي المسؤول (نطاق الدقهلية) */
const HOLDERS: Record<string, string> = {
  "مشرف التنفيذ": "sup.d1",
  "إدارة التنفيذ": "exec.d1",
  "المدير العام": "gm.g1",
  "الشئون الفنية": "tech.s1",
  "التخطيط": "planning",
  "التسعير": "planning",
  "رئاسة القطاعات": "pres.pr1",
  "اللجنة العليا": "committee",
  "رئيس القطاع": "sh.s1",
  "المخازن والمشتريات": "stores.s1",
};

const invoiceNo = `E2E-${Date.now().toString(36).toUpperCase()}`;
let fx: Fixtures;
let url = "";
let aoId = "";

test.beforeAll(async () => {
  fx = await makeFixtures();
});

test("المقاول يقدّم مستخلصاً جديداً عبر المعالج", async ({ browser }) => {
  await as(browser, "co1", async (page) => {
    await page.goto("/invoices/new");
    await selectByLabelPrefix(page.locator("#w-contract"), "DEMO-101/2025");
    aoId = await selectByLabelPrefix(page.locator("#w-ao"), "WO-2115");
    await page.fill("#w-no", invoiceNo);
    await expect(page.getByText("رئاسة القطاعات").first()).toBeVisible();
    await page.click('button:has-text("التالي")');

    // البنود: الملف فيه أخطاء — التقديم ممنوع لحد ما تتشال
    await expect(page.getByText("بنود الأعمال").first()).toBeVisible();
    await ok(page, () => page.setInputFiles('input[type=file][accept=".xlsx"]', fx.lines));
    await expect(page.getByText("معاينة البنود").first()).toBeVisible();
    const blocked = await act(page, () => page.click('button:has-text("التالي")'));
    expect(blocked.kind).toBe("err");
    await page.click('button:has-text("حذف الصفوف التي بها أخطاء")');
    await page.click('button:has-text("التالي")');

    await expect(page.getByText("المهمات المنفذة").first()).toBeVisible();
    await page.setInputFiles('input[type=file][accept=".xlsx"]', fx.mats);
    await expect(page.getByText("مقارنة المهمات").first()).toBeVisible();
    await page.click('button:has-text("التالي")');

    // المستندات الإلزامية (آخر خانة = مرفقات أخرى اختيارية)
    await expect(page.getByText("المستندات الإلزامية").first()).toBeVisible();
    const inputs = page.locator("input[type=file][multiple]");
    const n = await inputs.count();
    for (let i = 0; i < n - 1; i++) {
      await inputs.nth(i).setInputFiles(fx.pdf);
      await expect(page.locator("text=doc.pdf")).toHaveCount(i + 1);
    }
    await page.click('button:has-text("تقديم المستخلص")');
    await page.waitForURL(/\/invoices\/[a-z0-9]+$/);
    url = new URL(page.url()).pathname;
    await expectHolder(page, url, "مشرف التنفيذ");
  });
});

test("مشرف التنفيذ يعدّل الكمية المعتمدة ويعتمد", async ({ browser }) => {
  await as(browser, "sup.d1", async (page) => {
    await page.goto("/inbox");
    await expect(page.locator("main tbody").getByText(invoiceNo).first()).toBeVisible();
    await openInvoice(page, url);
    await page.click('button[aria-label="تعديل الكمية المعتمدة للبند 4-2-1"]');
    await page.locator("dialog[open] input[inputmode=decimal]").fill("1650");
    await page.locator("dialog[open] textarea").fill("نتيجة الحصر المشترك");
    await ok(page, () => modalBtn(page, "حفظ التعديل").click());
    await approve(page);
    await expectHolder(page, url, "إدارة التنفيذ");
  });
});

test("مدير التنفيذ يحدد فئة التجاوز قبل الاعتماد", async ({ browser }) => {
  await as(browser, "exec.d1", async (page) => {
    await openInvoice(page, url);
    await expect(bar(page, "اعتماد وإحالة")).toBeDisabled();
    await bar(page, "تحديد فئة التجاوز").click();
    await ok(page, () => modalBtn(page, "حفظ الفئة").click());
    await approve(page);
    await expectHolder(page, url, "المدير العام");
  });
});

test("المدير العام يعيد المستخلص للمقاول للاستيفاء (السبب إلزامي)", async ({ browser }) => {
  await as(browser, "gm.g1", async (page) => {
    await openInvoice(page, url);
    await bar(page, "إعادة للاستيفاء").click();
    await modalBtn(page, "إعادة للاستيفاء").click();
    await expect(page.locator("dialog[open] [role=alert]")).toBeVisible();
    await page.locator("dialog[open] input[type=checkbox]").first().check();
    await page.fill("#ret-note", "يرجى إرفاق محضر الحصر المعدل وتعديل كمية الحفر");
    await ok(page, () => modalBtn(page, "إعادة للاستيفاء").click());
    await expectHolder(page, url, "النيل");
  });
});

test("المقاول يستبدل البنود ويعيد التقديم — يرجع لنفس المرحلة", async ({ browser }) => {
  await as(browser, "co1", async (page) => {
    await page.goto("/inbox");
    await expect(page.locator("main tbody").getByText(invoiceNo).first()).toBeVisible();
    await openInvoice(page, url);
    await ok(page, () => page.locator('input[type=file][accept=".xlsx"]').first().setInputFiles(fx.lines2));
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/attachments") && r.request().method() === "POST" && r.ok()),
      page.locator("input[type=file][multiple]").last().setInputFiles(fx.pdf),
    ]);
    await openInvoice(page, url);
    await bar(page, "إعادة التقديم").click();
    await page.fill("#rs-note", "تم تعديل الكميات وإرفاق المحضر");
    await ok(page, () => modalBtn(page, "إعادة التقديم").click());
    await expectHolder(page, url, "المدير العام");
  });
});

test("المدير العام يعتمد، والشئون الفنية توقف مؤقتاً ثم تستأنف وتعتمد", async ({ browser }) => {
  await as(browser, "gm.g1", async (page) => {
    await openInvoice(page, url);
    await approve(page);
    await expectHolder(page, url, "الشئون الفنية");
  });
  await as(browser, "tech.s1", async (page) => {
    await openInvoice(page, url);
    await bar(page, "إيقاف مؤقت").click();
    await ok(page, () => modalBtn(page, "إيقاف مؤقت").click());
    await expectHolder(page, url, /موقوف مؤقتاً/);
    await bar(page, "استئناف").click();
    await ok(page, () => modalBtn(page, "استئناف").click());
    await expectHolder(page, url, "الشئون الفنية");
    await approve(page);
  });
});

test("باقي مراحل المسار حتى الإدارة المالية", async ({ browser }) => {
  for (let i = 0; i < 8; i++) {
    let at = "";
    await as(browser, "pmo", async (page) => {
      await openInvoice(page, url);
      at = await holder(page);
    });
    if (at === "الإدارة المالية") return;
    const who = HOLDERS[at];
    expect(who, `جهة غير متوقعة في المسار: ${at}`).toBeTruthy();
    await as(browser, who, async (page) => {
      await openInvoice(page, url);
      await approve(page);
    });
  }
  throw new Error("المستخلص لم يصل إلى الإدارة المالية");
});

test("المالية: غرامة تأخير يدوية (السبب إلزامي) ثم السداد — مع قفل تجاوز الارتباط", async ({ browser }) => {
  let locked = false;
  await as(browser, "finance", async (page) => {
    await openInvoice(page, url, "money");
    await page.click('button:has-text("مراجعة الاستقطاعات")');
    await modalBtn(page, "إضافة غرامة").click();
    await page.locator('dialog[open] input[aria-label="القيمة"]').last().fill("5000");
    await modalBtn(page, "حفظ الاستقطاعات").click();
    await expect(page.locator("dialog[open] [role=alert]").first()).toContainText("سبب");
    await page.locator('dialog[open] input[aria-label="السبب"]').last().fill("تأخير 12 يوماً عن الجدول الزمني");
    await ok(page, () => modalBtn(page, "حفظ الاستقطاعات").click());

    await openInvoice(page, url);
    await bar(page, "تسجيل السداد").click();
    locked = await modalBtn(page, "تأكيد السداد").isDisabled();
    if (locked) await expect(page.locator("dialog[open] [role=alert]").first()).toContainText("الارتباط");
    test.info().annotations.push({ type: "commitment", description: locked ? "السداد كان مقفلاً — تم التعزيز" : "في حدود الارتباط" });
  });

  if (locked) {
    // القفل التام: الشئون الفنية تسجل خطاب تعزيز الارتباط على أمر التكليف
    await as(browser, "tech.s1", async (page) => {
      await page.goto(`/contracts/${aoId}`);
      await page.click('button:has-text("تعزيز الارتباط المالي")');
      await page.fill("#cr-total", "50000000");
      await page.fill("#cr-ref", "خطاب تعزيز — اختبار آلي");
      await ok(page, () => modalBtn(page, "حفظ").click());
    });
  }

  await as(browser, "finance", async (page) => {
    await openInvoice(page, url);
    await bar(page, "تسجيل السداد").click();
    await expect(modalBtn(page, "تأكيد السداد")).toBeEnabled();
    await page.fill("#pay-ref", "458213");
    await ok(page, () => modalBtn(page, "تأكيد السداد").click());
    await openInvoice(page, url);
    await expect(page.getByText("تم السداد").first()).toBeVisible();
  });
});

test("صرف المحتجز على نفس المستخلص يتطلب مستنده", async ({ browser }) => {
  await as(browser, "finance", async (page) => {
    await openInvoice(page, url, "money");
    const release = page.locator('button:has-text("صرف")').first();
    test.skip((await release.count()) === 0, "العقد بدون مبالغ محتجزة");
    await release.click();
    await expect(modalBtn(page, "تأكيد الصرف")).toBeDisabled();
    await page.locator("dialog[open] input[type=file]").setInputFiles(fx.pdf);
    await expect(modalBtn(page, "تأكيد الصرف")).toBeEnabled();
    await page.fill("#rel-ref", "5566");
    await ok(page, () => modalBtn(page, "تأكيد الصرف").click());
  });
});

test("التقارير: المؤشرات والتصدير بنفس الفلتر", async ({ browser }) => {
  await as(browser, "pmo", async (page) => {
    await page.goto("/reports");
    await expect(page.getByText("نسبة الالتزام بالمدة المستهدفة")).toBeVisible();
    await page.selectOption('select[aria-label="القطاع"]', { index: 1 });
    await page.waitForURL(/sector=/);
    const href = await page.locator('a:has-text("تصدير Excel")').getAttribute("href");
    expect(href).toContain("sector=");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
  });
});

test("حدود الصلاحيات: مقاول آخر لا يرى المستخلص، والمقاول لا يدخل صفحات الإدارة", async ({ browser }) => {
  await as(browser, "co2", async (page) => {
    await page.goto(url);
    await expect(page.getByText("الصفحة غير موجودة")).toBeVisible();
    await page.goto("/emails");
    await expect(page.getByText(/لا تملك صلاحية|الصفحة غير موجودة/).first()).toBeVisible();
  });
});

test("مدير النظام: حالة النسخ الاحتياطي وسجل البريد", async ({ browser }) => {
  await as(browser, "admin", async (page) => {
    await page.goto("/");
    await expect(page.getByText(/النسخ الاحتياطي/).first()).toBeVisible();
    await page.goto(`/emails?q=${encodeURIComponent(invoiceNo)}`);
    await expect(page.locator("main").getByText(`تم سداد المستخلص رقم ${invoiceNo}`).first()).toBeVisible();
    await expect(page.locator("main").getByText(`ورد إليك المستخلص رقم ${invoiceNo}`).first()).toBeVisible();
  });
});
