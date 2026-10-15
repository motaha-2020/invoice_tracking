import "server-only";
import type { Importer } from "./import.types";

/**
 * سجل الـ importers — كل feature بتسجّل الـ importer بتاعها هنا (سطر واحد).
 * المفتاح = template_id اللي في الشيت المخفي _meta.
 */
const importers = new Map<string, Importer>();

export function registerImporter(imp: Importer<any>): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  importers.set(imp.templateId, imp as Importer);
}

export function getImporter(templateId: string): Importer | undefined {
  return importers.get(templateId);
}

export function listImporters(): Importer[] {
  return [...importers.values()];
}
