import { describe, expect, it } from "vitest";
import type { RawRow } from "../imports/import.types";
import { companyUpdateData, validateCompanyRows, type ExistingCompany } from "./companies-import.rules";

let n = 3;
const row = (v: Record<string, unknown>): RawRow => ({ __row: n++, ...v });
const ok = { code: "CO-1", name: "بريدج", full_name: "شركة بريدج", email: "Inv@Bridge.com" };

describe("validateCompanyRows", () => {
  it("صف سليم ← create والإيميل lowercase", () => {
    const [r] = validateCompanyRows([row(ok)], new Map());
    expect(r!.status).toBe("create");
    expect(r!.data).toMatchObject({ code: "CO-1", email: "inv@bridge.com", phone: null });
  });

  it("الإيميل إلزامي ولازم يبقى صح", () => {
    const rows = validateCompanyRows([row({ ...ok, email: "" }), row({ ...ok, code: "CO-2", email: "bad" })], new Map());
    expect(rows.map((r) => r.status)).toEqual(["error", "error"]);
    expect(rows[0]!.errors.join()).toContain("إلزامي");
  });

  it("الكود المتكرر: التاني خطأ", () => {
    const rows = validateCompanyRows([row(ok), row(ok)], new Map());
    expect(rows.map((r) => r.status)).toEqual(["create", "error"]);
  });

  it("تليفون متسجل كرقم ← تحذير", () => {
    const [r] = validateCompanyRows([row({ ...ok, phone: 1001234567 })], new Map());
    expect(r!.status).toBe("create");
    expect(r!.warnings.join()).toContain("الصفر");
  });

  it("تحديث: الخلايا الاختيارية الفاضية مش بتمسح القديم ومش بتعتبر تغيير", () => {
    const existing = new Map<string, ExistingCompany>([
      ["CO-1", { name: "بريدج", fullName: "شركة بريدج", email: "inv@bridge.com", commercialReg: "123", taxNo: null, phone: "0100", address: null }],
    ]);
    const [same] = validateCompanyRows([row(ok)], existing);
    expect(same!.status).toBe("skip");
    const [changed] = validateCompanyRows([row({ ...ok, tax_no: "999" })], existing);
    expect(changed!.status).toBe("update");
    expect(companyUpdateData(changed!.data!)).toEqual({ name: "بريدج", fullName: "شركة بريدج", email: "inv@bridge.com", taxNo: "999" });
  });
});
