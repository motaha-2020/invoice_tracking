"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { KIND_LABELS, type OrgKind } from "../org.kinds";
import { useOrgDialogs, type DeleteTarget, type EntityRecord } from "./org-dialogs";

/** زرار "إضافة …" — بيختفي لو المستخدم مالوش صلاحية تعديل */
export function AddButton({
  kind,
  defaults,
  variant = "pr",
  size = "md",
  label,
}: {
  kind: OrgKind;
  defaults?: EntityRecord;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
}) {
  const { canEdit, openForm } = useOrgDialogs();
  if (!canEdit) return null;
  return (
    <Button variant={variant} size={size} onClick={() => openForm(kind, null, defaults)}>
      <Plus aria-hidden /> {label ?? KIND_LABELS[kind].one}
    </Button>
  );
}

/** تعديل + مسح لصف في جدول أو تفاصيل عقدة */
export function RowActions({ kind, record, size = "sm" }: { kind: OrgKind; record: EntityRecord & DeleteTarget; size?: ButtonSize }) {
  const { canEdit, openForm, openDelete } = useOrgDialogs();
  if (!canEdit) return null;
  const { one } = KIND_LABELS[kind];
  return (
    <span className="inline-flex gap-1">
      <Button variant="gh" size={size} icon onClick={() => openForm(kind, record)} aria-label={`تعديل ${one} ${record.name}`} title="تعديل">
        <Pencil />
      </Button>
      <Button
        variant="gh"
        size={size}
        icon
        onClick={() => openDelete(kind, { id: record.id, code: record.code, name: record.name })}
        aria-label={`حذف ${one} ${record.name}`}
        title="حذف"
        className="text-cr6"
      >
        <Trash2 />
      </Button>
    </span>
  );
}
