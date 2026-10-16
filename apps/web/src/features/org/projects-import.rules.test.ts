import { describe, expect, it } from "vitest";
import type { RawRow } from "../imports/import.types";
import { validateProjectSheets, type ExistingProject, type ExistingProjectsData } from "./projects-import.rules";

let n = 3;
const row = (v: Record<string, unknown>): RawRow => ({ __row: n++, ...v });
const existing = (projects: [string, ExistingProject][] = []): ExistingProjectsData => ({
  types: new Map([["FTTH", { name: "FTTH" }]]),
  centrals: new Map([
    ["C-1", { name: "سنترال 1" }],
    ["C-2", { name: "سنترال 2" }],
  ]),
  projects: new Map(projects),
});

describe("validateProjectSheets", () => {
  it("نوع جديد في نفس الملف يتستخدم في المشروعات", () => {
    const rows = validateProjectSheets(
      {
        "أنواع المشروعات": [row({ code: "msan", name: "إحلال" })],
        المشروعات: [row({ code: "PJ-1", name: "مشروع", type_code: "MSAN", central_code: "c-1", start_date: "15/03/2026" })],
      },
      existing(),
    );
    expect(rows.map((r) => r.status)).toEqual(["create", "create"]);
    expect(rows[1]!.data).toMatchObject({ kind: "project", typeCode: "MSAN", centralCode: "C-1", startDate: "2026-03-15", notes: null });
  });

  it("سنترال مش موجود في المنظومة ← خطأ", () => {
    const [r] = validateProjectSheets({ المشروعات: [row({ code: "PJ-2", name: "x", type_code: "FTTH", central_code: "C-404" })] }, existing());
    expect(r!.status).toBe("error");
    expect(r!.errors.join()).toContain("C-404");
  });

  it("نوع مش موجود ← خطأ، ونوع فيه أخطاء في الملف ← خطأ", () => {
    const rows = validateProjectSheets(
      {
        "أنواع المشروعات": [row({ code: "BAD", name: "" })],
        المشروعات: [
          row({ code: "PJ-3", name: "x", type_code: "ZZZ", central_code: "C-1" }),
          row({ code: "PJ-4", name: "y", type_code: "BAD", central_code: "C-1" }),
        ],
      },
      existing(),
    );
    expect(rows[1]!.errors.join()).toContain("مفيش نوع مشروع");
    expect(rows[2]!.errors.join()).toContain("فيه أخطاء");
  });

  it("تاريخ غلط ← خطأ، وكود مكرر ← التاني خطأ", () => {
    const rows = validateProjectSheets(
      {
        المشروعات: [
          row({ code: "PJ-5", name: "x", type_code: "FTTH", central_code: "C-1", start_date: "بكرة" }),
          row({ code: "PJ-6", name: "x", type_code: "FTTH", central_code: "C-1" }),
          row({ code: "PJ-6", name: "x", type_code: "FTTH", central_code: "C-1" }),
        ],
      },
      existing(),
    );
    expect(rows.map((r) => r.status)).toEqual(["error", "create", "error"]);
  });

  it("تحديث: مفيش تغيير ← skip (الخلايا الفاضية مش تغيير)، ونقل السنترال ← update بتحذير", () => {
    const projects: [string, ExistingProject][] = [
      ["PJ-1", { name: "مشروع", typeCode: "FTTH", centralCode: "C-1", startDate: "2026-01-01", notes: "ملاحظة" }],
    ];
    const [same] = validateProjectSheets(
      { المشروعات: [row({ code: "PJ-1", name: "مشروع", type_code: "FTTH", central_code: "C-1" })] },
      existing(projects),
    );
    expect(same!.status).toBe("skip");
    const [moved] = validateProjectSheets(
      { المشروعات: [row({ code: "PJ-1", name: "مشروع", type_code: "FTTH", central_code: "C-2" })] },
      existing(projects),
    );
    expect(moved!.status).toBe("update");
    expect(moved!.warnings.join()).toContain("هيتنقل");
  });
});
