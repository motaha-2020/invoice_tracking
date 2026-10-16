import { describe, expect, it } from "vitest";
import { DEFAULT_FROM_NAME, isReservedTestAddress, resolveSmtp } from "./smtp.rules";

const open = (s: string) => (s === "sealed-ok" ? "pw" : null);

describe("resolveSmtp", () => {
  it("is off with nothing configured", () => {
    expect(resolveSmtp({ smtpHost: "" }, {}, open)).toBeNull();
  });

  it("uses the saved settings first", () => {
    const c = resolveSmtp(
      { smtpHost: " smtp.gmail.com ", smtpPort: 587, smtpSecure: false, smtpUser: "a@x.com", smtpPassword: "sealed-ok", smtpFrom: "", smtpFromName: "" },
      { SMTP_HOST: "env.host" },
      open,
    );
    expect(c).toMatchObject({ source: "db", host: "smtp.gmail.com", port: 587, secure: false, user: "a@x.com", password: "pw", from: "a@x.com", fromName: DEFAULT_FROM_NAME, passwordBroken: false });
  });

  it("flags a password that can no longer be decrypted", () => {
    expect(resolveSmtp({ smtpHost: "h", smtpPassword: "sealed-bad" }, {}, open)).toMatchObject({ password: "", passwordBroken: true });
  });

  it("treats port 465 as SSL and rejects bad ports", () => {
    expect(resolveSmtp({ smtpHost: "h", smtpPort: 465 }, {}, open)?.secure).toBe(true);
    expect(resolveSmtp({ smtpHost: "h", smtpPort: "abc" }, {}, open)?.port).toBe(587);
  });

  it("falls back to the server environment", () => {
    expect(resolveSmtp({}, { SMTP_HOST: "mail.te.eg", SMTP_PORT: "25", SMTP_USER: "u", SMTP_PASSWORD: "p" }, open)).toMatchObject({
      source: "env",
      host: "mail.te.eg",
      port: 25,
      secure: false,
      from: "u",
    });
  });
});

describe("isReservedTestAddress", () => {
  it("عناوين الاختبار المحجوزة", () => {
    expect(isReservedTestAddress("test.sup@invoices.test")).toBe(true);
    expect(isReservedTestAddress("a@example.com")).toBe(true);
    expect(isReservedTestAddress("x@foo.invalid")).toBe(true);
  });
  it("العناوين الحقيقية", () => {
    expect(isReservedTestAddress("motaha2012@gmail.com")).toBe(false);
    expect(isReservedTestAddress("ahmad@te.eg")).toBe(false);
    expect(isReservedTestAddress("someone@mytest.com")).toBe(false);
  });
});
