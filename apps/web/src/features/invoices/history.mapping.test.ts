import { describe, expect, it } from "vitest";
import { HOLD_REASON_AO, inferWorkTypeCode, mapStepName, normalizeArabic } from "./history.mapping";

describe("mapStepName", () => {
  it.each([
    ["مشرف التنفيذ", "sup"],
    ["مدير التنفيذ", "exec"],
    ["المدير العام", "gm"],
    ["الشئون الفنية", "tech"],
    ["التخطيط", "plan"],
    ["رئيس القطاع", "sector"],
    ["المخازن والمشتريات", "stores"],
    ["المالية", "finance"],
  ])("%s ← جاري عند %s", (name, step) => {
    expect(mapStepName(name)).toEqual({ status: "active", currentStep: step, heldAt: null, holdReason: null });
  });

  it("الشركة ← مسودة من غير محطة", () => {
    expect(mapStepName("الشركة")).toMatchObject({ status: "draft", currentStep: null });
  });

  it("تم الصرف ← مصروف", () => {
    expect(mapStepName("تم الصرف")).toMatchObject({ status: "paid", currentStep: null });
  });

  it("بانتظار أمر التكليف ← معلّق مع السبب", () => {
    expect(mapStepName("بانتظار أمر التكليف")).toEqual({
      status: "on_hold",
      currentStep: "sup",
      heldAt: "sup",
      holdReason: HOLD_REASON_AO,
    });
  });

  it("بيتسامح في الهمزات والتاء المربوطة والمسافات", () => {
    expect(mapStepName("الشؤون  الفنيه")?.currentStep).toBe("tech");
    expect(mapStepName(" المخازن و المشتريات ")?.currentStep).toBe("stores");
    expect(mapStepName("المالــية")?.currentStep).toBe("finance");
  });

  it("اسم مش معروف ← null", () => {
    expect(mapStepName("مكتب الوزير")).toBeNull();
    expect(mapStepName("")).toBeNull();
  });

  it("بيرجع نسخة جديدة (التعديل عليها ما يأثرش على الجدول)", () => {
    const a = mapStepName("المالية")!;
    a.currentStep = "x";
    expect(mapStepName("المالية")!.currentStep).toBe("finance");
  });
});

describe("inferWorkTypeCode", () => {
  it("كهربي", () => {
    expect(inferWorkTypeCode("مستخلص الأعمال الكهربية - سنترال رابعة")).toBe("ELECTRICAL");
    expect(inferWorkTypeCode("كهرباء الكبائن")).toBe("ELECTRICAL");
  });
  it("تخطيط", () => {
    expect(inferWorkTypeCode("فاتورة تخطيط")).toBe("PLANNING");
  });
  it("صيانة مدني (بالتاء المربوطة أو الهاء)", () => {
    expect(inferWorkTypeCode("صيانة غرف التفتيش")).toBe("CIVIL_MAINT");
    expect(inferWorkTypeCode("صيانه مدنى")).toBe("CIVIL_MAINT");
  });
  it("أعمال متكاملة", () => {
    expect(inferWorkTypeCode("الأعمال المتكاملة - كمبوند")).toBe("INTEGRATED");
  });
  it("غير كده مدني", () => {
    expect(inferWorkTypeCode("حى الحدق - سنترال رابعة / 6 كبائن")).toBe("CIVIL");
    expect(inferWorkTypeCode("")).toBe("CIVIL");
  });
});

describe("normalizeArabic", () => {
  it("بيوحّد الأشكال", () => {
    expect(normalizeArabic("إدارة")).toBe("اداره");
    expect(normalizeArabic("مستشفى")).toBe("مستشفي");
  });
});
