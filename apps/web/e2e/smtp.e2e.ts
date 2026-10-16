import { expect, test } from "@playwright/test";
import net from "node:net";
import { as, ok } from "./helpers";

/**
 * شاشة «خادم البريد الإلكتروني»: مدير النظام يضبط الخادم ويرسل رسالة تجريبية، والمرسل يبدأ يبعت الصادر
 * من غير restart. الخادم هنا SMTP بسيط جوه الاختبار بيسجل الرسائل اللي وصلته.
 */
test.describe.configure({ mode: "serial" });

type Mail = { from: string; to: string[]; data: string };
const inbox: Mail[] = [];
let server: net.Server;
let port = 0;
const sockets = new Set<net.Socket>();

test.beforeAll(async () => {
  server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on("close", () => sockets.delete(sock));
    let cur: Mail = { from: "", to: [], data: "" };
    let inData = false;
    let buf = "";
    sock.write("220 e2e-sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end < 0) return;
          cur.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          inbox.push(cur);
          cur = { from: "", to: [], data: "" };
          sock.write("250 OK queued\r\n");
          continue;
        }
        const nl = buf.indexOf("\r\n");
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") {
          sock.write("250-e2e-sink\r\n250 8BITMIME\r\n");
        } else if (cmd === "MAIL") {
          cur.from = line;
          sock.write("250 OK\r\n");
        } else if (cmd === "RCPT") {
          cur.to.push(line);
          sock.write("250 OK\r\n");
        } else if (cmd === "DATA") {
          inData = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") {
          sock.end("221 bye\r\n");
        } else {
          sock.write("250 OK\r\n");
        }
      }
    });
    sock.on("error", () => {});
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as net.AddressInfo).port;
});

test.afterAll(async () => {
  // المنظومة بتحتفظ باتصال مفتوح (pool) — نقفله عشان السيرفر يقفل
  for (const s of sockets) s.destroy();
  await new Promise((r) => server.close(r));
});

test("مدير النظام يضبط خادم البريد ويرسل رسالة تجريبية — والصادر يُرسل تلقائياً", async ({ browser }) => {
  await as(browser, "admin", async (page) => {
    const pendingCount = async () => {
      await page.goto("/emails");
      const t = (await page.locator('a[href="/emails?status=pending"]').first().textContent()) ?? "";
      return Number(t.replace(/\D/g, "") || 0);
    };
    const pendingBefore = await pendingCount();

    await page.goto("/workflow?tab=settings");
    await expect(page.getByText("خادم البريد الإلكتروني (SMTP)")).toBeVisible();

    // عنوان مرسل غلط → رسالة تحقق
    await page.fill("#smtp-host", "127.0.0.1");
    await page.fill("#smtp-port", String(port));
    await page.fill("#smtp-user", "");
    await page.fill("#smtp-from", "not-an-email");
    await page.click('button:has-text("حفظ إعدادات البريد")');
    await expect(page.getByText("عنوان المرسل غير صحيح")).toBeVisible();

    await page.fill("#smtp-from", "invoices@example.test");
    await page.fill("#smtp-pass", "secret-for-e2e");
    await ok(page, () => page.click('button:has-text("حفظ إعدادات البريد")'), /تم حفظ/);
    await expect(page.getByText(/الإرسال مفعّل عبر/)).toBeVisible();
    await expect(page.locator("#smtp-pass")).toHaveValue("");
    await expect(page.getByText("محفوظة ومشفّرة")).toBeVisible();

    await ok(page, () => page.click('button:has-text("إرسال رسالة تجريبية")'), /admin@example\.test/);
    const t = inbox.find((m) => m.to.some((r) => r.includes("admin@example.test")) && m.data.includes("Subject:"));
    expect(t, "الرسالة التجريبية وصلت للخادم").toBeTruthy();

    // المرسل بيلتقط الإعدادات الجديدة ويبعت الرسائل اللي كانت قيد الإرسال (كل 30 ثانية)
    if (pendingBefore > 0) {
      await expect.poll(() => inbox.length, { timeout: 75_000 }).toBeGreaterThan(1);
      await expect.poll(pendingCount, { timeout: 75_000 }).toBe(0);
    }
  });
});

test("PMO يرى إعدادات البريد للاطلاع فقط", async ({ browser }) => {
  await as(browser, "pmo", async (page) => {
    await page.goto("/workflow?tab=settings");
    await expect(page.getByText("تعديل إعدادات البريد متاح لمدير النظام فقط")).toBeVisible();
    await expect(page.locator("#smtp-host")).toHaveAttribute("readonly", "");
    await expect(page.locator("#smtp-pass")).toHaveCount(0);
  });
});

test("إيقاف الإرسال بتفريغ الخادم", async ({ browser }) => {
  await as(browser, "admin", async (page) => {
    await page.goto("/workflow?tab=settings");
    await page.fill("#smtp-host", "");
    await ok(page, () => page.click('button:has-text("حفظ إعدادات البريد")'), /إيقاف/);
    await expect(page.getByText("الإرسال غير مفعّل")).toBeVisible();
  });
});
