import { describe, expect, it } from "vitest";
import { emailBody, emailSubject, notificationTitle, type MessageContext } from "./flow-messages";

const base: MessageContext = {
  kind: "approved", invoiceNo: "501", companyName: "النيل", aoNo: "WO-2115", pathName: "FTTH المنصورة",
  stepName: "مراجعة واعتماد المدير العام", fromName: "إدارة التنفيذ", url: "https://x.test/invoices/1",
};

describe("flow messages", () => {
  it("builds title, subject and a formal body with the link", () => {
    expect(notificationTitle(base)).toContain("501");
    expect(emailSubject(base)).toContain("منظومة تتبع المستخلصات");
    const body = emailBody({ ...base, note: "ملاحظة", reasons: ["توقيع ناقص"] }, "أحمد");
    expect(body).toContain("السيد/ أحمد");
    expect(body).toContain("«مراجعة واعتماد المدير العام»");
    expect(body).toContain("أسباب الإعادة: توقيع ناقص");
    expect(body).toContain("https://x.test/invoices/1");
  });

  it("includes payment details when paid", () => {
    const body = emailBody({ ...base, kind: "paid", paymentRef: "شيك رقم 1", amount: "1,000.00" }, "الشركة");
    expect(body).toContain("شيك رقم 1");
    expect(body).toContain("1,000.00 جنيه");
  });
});
