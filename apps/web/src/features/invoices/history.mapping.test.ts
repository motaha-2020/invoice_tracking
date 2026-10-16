import { describe, expect, it } from "vitest";
import { HOLD_REASON_AO, inferWorkTypeCode, mapStepName, migratedCategory, normalizeArabic } from "./history.mapping";

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

describe("mapStepName — عبارات ملفات الموقف", () => {
  it.each([
    ["منصرف\n", "paid", null],
    ["جارى المراجعة مع مدير إدارة التنفيذ (م/ محمد عليوة)", "active", "exec"],
    ["جارى التوقيع من مدير الإدارة\n ( م/ أحمد أشرف)", "active", "exec"],
    ["جارى التوقيع من مدير عام التنفيذ\n ( د/ ياسر عبد السميع )", "active", "gm"],
    ["جارى المراجعة مع مركز الصيانة - بورسعيد ( م/ حمدى) مدير عام مناطق بورسعيد", "active", "gm"],
    ["الشؤن الفنية \n", "active", "tech"],
    ["المخازن\n", "active", "stores"],
    ["جارى المراجعة مع مشرف التنفيذ \n( م/ طارق شعراوى )", "active", "sup"],
    ["جارى توقيع شهادة الرئيسي", "active", "sup"],
    ["تم عمل الفاتورة وجارى الإعتماد", "active", "sup"],
    ["تحت اليد / م. احمد سعيد", "draft", null],
    ["جارى المراجعة والتعديل ( تحت اليد)", "draft", null],
    ["تحت القياس والمراجعة", "draft", null],
    ["تقديري ", "draft", null],
  ])("%s", (name, status, step) => {
    expect(mapStepName(name)).toMatchObject({ status, currentStep: step });
  });

  it("بانتظار اعتماد أمر التكليف ← موقوف عند المشرف", () => {
    expect(mapStepName("بإنتظار إعتماد امر التكليف")).toEqual({ status: "on_hold", currentStep: "sup", heldAt: "sup", holdReason: HOLD_REASON_AO });
  });
  it("موقوف عند المرحلة المذكورة مع انتظار أمر التكليف", () => {
    expect(mapStepName("جارى التوقيع مدير عام تنفيذ (م/ جمال فؤاد)+ فى انتظار امر التكليف")).toMatchObject({ status: "on_hold", heldAt: "gm" });
  });
  it("اسم شخص من غير جهة ← غير معروف", () => {
    expect(mapStepName("م. مجدى غريب")).toBeNull();
  });
});

describe("migratedCategory", () => {
  const path = (...steps: string[]) => ({ name: "", path: steps.map((step) => ({ step, slaDays: 1 })) });
  const config = {
    steps: {},
    categories: {
      C1: path("sup", "exec", "gm", "tech", "stores", "finance"),
      C2: path("sup", "exec", "gm", "tech", "plan", "stores", "finance"),
      C3: path("sup", "exec", "gm", "tech", "plan", "sector", "stores", "finance"),
      C4: path("sup", "exec", "gm", "tech", "plan", "pres", "committee", "sector", "stores", "finance"),
      C5: path("sup", "exec", "gm", "tech", "plan", "pricing", "pres", "committee", "sector", "stores", "finance"),
    },
  } as unknown as Parameters<typeof migratedCategory>[0];
  const at = (s: string) => mapStepName(s)!;

  it("قبل أو عند مرحلة تحديد الفئة ← من غير فئة", () => {
    expect(migratedCategory(config, at("مشرف التنفيذ"))).toBeNull();
    expect(migratedCategory(config, at("مدير التنفيذ"))).toBeNull();
    expect(migratedCategory(config, at("الشركة"))).toBeNull();
  });
  it("بعدها ← أول فئة مسارها فيه المرحلة", () => {
    expect(migratedCategory(config, at("الشئون الفنية"))).toBe("C1");
    expect(migratedCategory(config, at("المخازن"))).toBe("C1");
    expect(migratedCategory(config, at("التخطيط"))).toBe("C2");
    expect(migratedCategory(config, at("رئيس القطاع"))).toBe("C3");
    expect(migratedCategory(config, at("تم الصرف"))).toBe("C1");
  });
  it("الموقوف بيتحسب بمرحلة الإيقاف", () => {
    expect(migratedCategory(config, at("جارى التوقيع مدير عام تنفيذ + فى انتظار امر التكليف"))).toBe("C1");
  });
});
