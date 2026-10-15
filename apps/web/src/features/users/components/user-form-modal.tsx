"use client";

import { Save, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { inviteUserAction, saveUserAction } from "../users.actions";
import type { RoleScopeInput } from "../users.rules";
import type { ScopeOptions, UserRow } from "../users.types";
import { CopyLink } from "./copy-link";
import { RoleScopeRows, newRoleScope } from "./role-scope-rows";

type Props = { user: UserRow | null; options: ScopeOptions; onClose: () => void };

/** فورم مستخدم جديد / تعديل. بيتعمل mount من جديد مع كل فتح (key) فالـ state بيبدأ نضيف. */
export function UserFormModal({ user, options, onClose }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const [roles, setRoles] = useState<RoleScopeInput[]>(
    user?.roles.map(({ role, scopeType, scopeId }) => ({ role, scopeType, scopeId })) ?? [newRoleScope(options)],
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string>();
  const [link, setLink] = useState<string>();

  const submit = (invite: boolean) =>
    start(async () => {
      setMessage(undefined);
      const res = await saveUserAction({ id: user?.id, name, email, phone, active, roles });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.message);
        return;
      }
      setErrors({});
      if (!invite || !res.userId) {
        toast.show(res.message ?? "اتحفظ", "ok");
        onClose();
        return;
      }
      const inv = await inviteUserAction(res.userId);
      if (!inv.ok || !inv.link) {
        setMessage(`اتحفظ المستخدم بس الدعوة ما اتعملتش: ${inv.message ?? ""}`);
        return;
      }
      setLink(inv.link);
    });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={user ? `تعديل: ${user.name}` : "مستخدم جديد"}
      footer={
        link ? (
          <Button onClick={onClose}>تمام</Button>
        ) : (
          <>
            {!user && (
              <Button variant="pr" disabled={pending} onClick={() => submit(true)}>
                <Send aria-hidden /> حفظ وإرسال دعوة
              </Button>
            )}
            <Button variant={user ? "pr" : "default"} disabled={pending} onClick={() => submit(false)}>
              <Save aria-hidden /> {pending ? "بيتحفظ…" : "حفظ"}
            </Button>
            <Button variant="gh" onClick={onClose}>إلغاء</Button>
          </>
        )
      }
    >
      {link ? (
        <>
          <Alert tone="g" title="اتحفظ المستخدم واتعملت الدعوة">
            الإيميل اتسجل في صندوق الصادر. لحد ما الإرسال يشتغل ابعت الرابط ده بنفسك — بيظهر مرة واحدة بس وصالح 72 ساعة.
          </Alert>
          <CopyLink link={link} />
        </>
      ) : (
        <>
          {message && <Alert tone="r">{message}</Alert>}
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label="الاسم" htmlFor="u-name" required error={errors.name}>
              <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label="الإيميل" htmlFor="u-email" required error={errors.email} hint="بيستخدم للدخول ولاستلام الإشعارات">
              <Input id="u-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            </Field>
            <Field label="الموبايل" htmlFor="u-phone" error={errors.phone}>
              <Input id="u-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </Field>
            <Field label="الحالة">
              <label className="flex h-[34px] items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> الحساب شغال
              </label>
            </Field>
          </div>
          <Field label="الأدوار والنطاقات" required error={errors.roles} hint="الدور بيحدد يعمل إيه، والنطاق بيحدد يشوف إيه">
            <RoleScopeRows value={roles} onChange={setRoles} options={options} />
          </Field>
        </>
      )}
    </Modal>
  );
}
