/**
 * قوايم الاختيار لفورم الإضافة/التعديل — كل اختيار متجمع تحت أبوه (optgroup) عشان القوايم الطويلة تتقري.
 */
import type { OptionsKey, OrgOptions, SelectOption } from "./components/entity-fields";
import type { OrgLevel } from "./org.kinds";
import type { OrgNodeRow, ProjectTypeRow } from "./org.service";
import { buildIndex, parentKeyOf } from "./org.tree";

const LEVEL_KEYS: (OptionsKey & OrgLevel)[] = ["presidency", "sector", "generalDept", "dept", "central"];

export function buildOrgOptions(nodes: readonly OrgNodeRow[], types: readonly ProjectTypeRow[]): OrgOptions {
  const index = buildIndex(nodes);
  const byName = (a: SelectOption, b: SelectOption) =>
    (a.group ?? "").localeCompare(b.group ?? "", "ar") || a.label.localeCompare(b.label, "ar");
  const out = { projectType: types.map((t) => ({ id: t.id, label: `${t.name} (${t.code})` })) } as OrgOptions;
  for (const level of LEVEL_KEYS) {
    out[level] = nodes
      .filter((n) => n.kind === level)
      .map((n) => {
        const pk = parentKeyOf(n);
        const parent = pk ? index.byKey.get(pk) : undefined;
        return { id: n.id, label: `${n.name} (${n.code})`, group: parent?.name };
      })
      .sort(byName);
  }
  return out;
}
