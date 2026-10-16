import "server-only";
import { CATEGORY_CODES, DEFAULT_SLA_WARN_AT, toIsoDate, type CategoryCode, type CategoryDef, type StepDef, type WorkflowConfig } from "@it/domain";
import type { Role } from "@it/db";
import { cache } from "react";
import { getSettings, listCategoriesWithSteps, listHolidays, listSteps } from "@/features/workflow/workflow.repo";

/**
 * إعدادات المسار الفعلية من قاعدة البيانات (المراحل + مسار كل فئة + العطلات + حد التنبيه)
 * بشكل WorkflowConfig اللي @it/domain بيفهمه. مرة واحدة لكل request.
 */
export type FlowContext = {
  config: WorkflowConfig;
  holidays: ReadonlySet<string>;
  warnAt: number;
  /** المرحلة ← الدور المسؤول */
  stepRoles: Readonly<Record<string, Role>>;
};

export const getFlowContext = cache(async (): Promise<FlowContext> => {
  const [steps, cats, holidays, settings] = await Promise.all([listSteps(), listCategoriesWithSteps(), listHolidays(), getSettings()]);
  const stepDefs: Record<string, StepDef> = {};
  const stepRoles: Record<string, Role> = {};
  for (const s of steps) {
    stepDefs[s.key] = { name: s.name, short: s.short, role: s.role };
    stepRoles[s.key] = s.role;
  }
  const categories = {} as Record<CategoryCode, CategoryDef>;
  for (const c of cats) {
    categories[c.code as CategoryCode] = { name: c.name, path: c.steps.map((s) => ({ step: s.stepKey, slaDays: s.slaDays })) };
  }
  const warn = Number(settings.slaWarnAt);
  return {
    config: { steps: stepDefs, categories },
    holidays: new Set(holidays.map((h) => toIsoDate(h.date))),
    warnAt: Number.isInteger(warn) && warn >= 0 ? warn : DEFAULT_SLA_WARN_AT,
    stepRoles,
  };
});

export function isCategoryCode(v: unknown): v is CategoryCode {
  return typeof v === "string" && (CATEGORY_CODES as readonly string[]).includes(v);
}
