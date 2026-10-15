"use client";

import { Pencil, Power, Send, UserPlus, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyState, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/labels";
import { inviteUserAction, setActiveAction } from "../users.actions";
import type { ScopeOptions, UserRow } from "../users.types";
import { CopyLink } from "./copy-link";
import { UserFormModal } from "./user-form-modal";

type Props = { users: UserRow[]; options: ScopeOptions; currentUserId: string };

function Status({ u }: { u: UserRow }) {
  if (!u.active) return <Badge tone="r">موقوف</Badge>;
  if (u.hasPassword) return <Badge tone="g">شغال</Badge>;
  return u.invitePending ? <Badge tone="a">مستني يقبل الدعوة</Badge> : <Badge tone="n">مفيش دعوة صالحة</Badge>;
}

export function UsersTable({ users, options, currentUserId }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  // undefined = مقفول، null = مستخدم جديد
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);
  const [invite, setInvite] = useState<{ name: string; link: string }>();
  const [confirmOff, setConfirmOff] = useState<UserRow>();

  const open = (u: UserRow | null) => {
    setFormKey((k) => k + 1);
    setEditing(u);
  };

  const sendInvite = (u: UserRow) =>
    start(async () => {
      const res = await inviteUserAction(u.id);
      if (res.ok && res.link) setInvite({ name: u.name, link: res.link });
      else toast.show(res.message ?? "حصل خطأ", "err");
    });

  const toggleActive = (u: UserRow, active: boolean) =>
    start(async () => {
      const res = await setActiveAction(u.id, active);
      toast.show(res.message ?? "", res.ok ? "ok" : "err");
      setConfirmOff(undefined);
    });

  return (
    <>
      <div className="flex justify-end border-b border-bd1 px-[18px] py-2.5">
        <Button variant="pr" onClick={() => open(null)}>
          <UserPlus aria-hidden /> مستخدم جديد
        </Button>
      </div>
      {users.length === 0 ? (
        <EmptyState icon={Users} title="مفيش مستخدمين بالبحث ده" />
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr><Th>الاسم</Th><Th>الأدوار والنطاقات</Th><Th>آخر دخول</Th><Th>الحالة</Th><Th /></Tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <Tr key={u.id} className={u.active ? undefined : "opacity-70"}>
                  <Td>
                    <b>{u.name}</b>
                    {u.id === currentUserId && <Badge tone="p" className="ms-1.5">إنت</Badge>}
                    <div dir="ltr" className="text-end text-xs text-tx3">{u.email}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      {u.roles.map((r) => (
                        <div key={`${r.role}-${r.scopeType}-${r.scopeId}`} className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="p">{ROLE_LABELS[r.role]}</Badge>
                          <span className="text-xs text-tx2">
                            {r.scopeType === "all" ? "كل الجهات" : `${SCOPE_TYPE_LABELS[r.scopeType]}: ${r.scopeName}`}
                          </span>
                        </div>
                      ))}
                      {u.roles.length === 0 && <span className="text-xs text-cr6">مالوش دور — مش هيشوف حاجة</span>}
                    </div>
                  </Td>
                  <Td className="text-xs"><span className="num">{formatDateTime(u.lastLoginAt)}</span></Td>
                  <Td><Status u={u} /></Td>
                  <Td align="end" className="whitespace-nowrap">
                    {u.active && (
                      <Button size="sm" variant="gh" disabled={pending} onClick={() => sendInvite(u)} title={u.hasPassword ? "رابط جديد لتحديد كلمة السر" : "إرسال دعوة"}>
                        <Send aria-hidden /> {u.hasPassword || u.invitePending ? "إعادة الدعوة" : "إرسال دعوة"}
                      </Button>
                    )}
                    <Button size="sm" variant="gh" icon aria-label="تعديل" onClick={() => open(u)}><Pencil /></Button>
                    {u.id !== currentUserId &&
                      (u.active ? (
                        <Button size="sm" variant="gh" icon aria-label="إيقاف الحساب" title="إيقاف" onClick={() => setConfirmOff(u)}><Power className="text-cr6" /></Button>
                      ) : (
                        <Button size="sm" variant="gh" disabled={pending} onClick={() => toggleActive(u, true)}>تفعيل</Button>
                      ))}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {editing !== undefined && <UserFormModal key={formKey} user={editing} options={options} onClose={() => setEditing(undefined)} />}

      <Modal open={!!invite} onClose={() => setInvite(undefined)} title={`دعوة ${invite?.name ?? ""}`} footer={<Button onClick={() => setInvite(undefined)}>تمام</Button>}>
        <Alert tone="i">الإيميل اتسجل في صندوق الصادر. لحد ما الإرسال يشتغل ابعت الرابط ده بنفسك — بيظهر مرة واحدة بس، وصالح 72 ساعة، وأي دعوة قديمة اتلغت.</Alert>
        {invite && <CopyLink link={invite.link} />}
      </Modal>

      <Modal
        open={!!confirmOff}
        onClose={() => setConfirmOff(undefined)}
        title="إيقاف حساب"
        footer={
          <>
            <Button variant="dg" disabled={pending} onClick={() => confirmOff && toggleActive(confirmOff, false)}>
              <Power aria-hidden /> أيوه، وقّفه
            </Button>
            <Button variant="gh" onClick={() => setConfirmOff(undefined)}>إلغاء</Button>
          </>
        }
      >
        <p className="m-0">
          توقف حساب <b>{confirmOff?.name}</b>؟ هيخرج فوراً من كل الأجهزة ومش هيقدر يدخل لحد ما تفعّله تاني. بياناته وسجلّه مش هيتمسحوا.
        </p>
      </Modal>
    </>
  );
}
