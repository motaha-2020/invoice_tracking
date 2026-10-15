"use client";

import type { Role, ScopeType } from "@it/db";
import { Plus, Trash2 } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/labels";
import { SCOPE_EXPLAIN } from "../users.labels";
import { ALL_ROLES, SCOPE_TYPES, defaultScopeType, type RoleScopeInput } from "../users.rules";
import type { ScopeOptions } from "../users.types";

type Props = { value: RoleScopeInput[]; onChange: (v: RoleScopeInput[]) => void; options: ScopeOptions };

/** أول جهة في القايمة (عشان الصف يبقى سليم من أول ما يتضاف) */
function firstId(options: ScopeOptions, t: ScopeType): string | null {
  return t === "all" ? null : (options[t][0]?.id ?? null);
}

export function newRoleScope(options: ScopeOptions, role: Role = "exec_mgr"): RoleScopeInput {
  const scopeType = defaultScopeType(role);
  return { role, scopeType, scopeId: firstId(options, scopeType) };
}

/** صفوف (دور + نوع نطاق + الجهة). تغيير الدور بيرجّع النطاق المعتاد ليه. */
export function RoleScopeRows({ value, onChange, options }: Props) {
  const set = (i: number, patch: Partial<RoleScopeInput>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {value.map((rs, i) => {
        const def = defaultScopeType(rs.role);
        const list = rs.scopeType === "all" ? [] : options[rs.scopeType];
        return (
          <div key={i} className="rounded-base border border-bd1 bg-hover p-2.5">
            <div className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-center gap-2 max-sm:grid-cols-1">
              <Select
                aria-label="الدور"
                value={rs.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  const scopeType = defaultScopeType(role);
                  set(i, { role, scopeType, scopeId: firstId(options, scopeType) });
                }}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
              <Select
                aria-label="نوع النطاق"
                value={rs.scopeType}
                onChange={(e) => {
                  const scopeType = e.target.value as ScopeType;
                  set(i, { scopeType, scopeId: firstId(options, scopeType) });
                }}
              >
                {SCOPE_TYPES.map((t) => (
                  <option key={t} value={t}>{SCOPE_TYPE_LABELS[t]}</option>
                ))}
              </Select>
              {rs.scopeType === "all" ? (
                <div className="px-2 text-sm text-tx3">كل الجهات</div>
              ) : list.length === 0 ? (
                <div className="px-2 text-xs text-cr6">مفيش {SCOPE_TYPE_LABELS[rs.scopeType]} متسجل — ارفع الهيكل الأول</div>
              ) : (
                <Select aria-label={SCOPE_TYPE_LABELS[rs.scopeType]} value={rs.scopeId ?? ""} onChange={(e) => set(i, { scopeId: e.target.value || null })}>
                  {list.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                  ))}
                </Select>
              )}
              <Button
                variant="gh"
                size="sm"
                icon
                aria-label="شيل الدور"
                disabled={value.length <= 1}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-1.5 text-xs text-tx3">
              {SCOPE_EXPLAIN[rs.scopeType]}
              {def !== rs.scopeType && <span className="text-wa7"> — النطاق المعتاد للدور ده &quot;{SCOPE_TYPE_LABELS[def]}&quot;</span>}
            </div>
          </div>
        );
      })}
      <Button size="sm" onClick={() => onChange([...value, newRoleScope(options)])}>
        <Plus aria-hidden /> دور / نطاق كمان
      </Button>
    </div>
  );
}
