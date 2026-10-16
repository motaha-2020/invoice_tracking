"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { inviteNewUsersAction } from "../users.actions";
import type { InviteLink } from "../users.types";
import { CopyLink } from "./copy-link";

/** بعد استيراد المستخدمين: دعوة واحدة لكل مستخدم جديد لسه ما اتبعتلوش — الروابط بتظهر مرة واحدة */
export function BulkInvite({ pendingCount }: { pendingCount: number }) {
  const [pending, start] = useTransition();
  const [links, setLinks] = useState<InviteLink[]>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  return (
    <Card>
      <CardHeader
        title="دعوات المستخدمين الجدد"
        sub={<>مستخدمون لم تُرسل إليهم دعوة بعد: <span className="num">{pendingCount}</span></>}
        actions={
          <Button
            variant="pr"
            disabled={pending || pendingCount === 0}
            onClick={() =>
              start(async () => {
                const res = await inviteNewUsersAction();
                setMessage({ ok: res.ok, text: res.message ?? "" });
                if (res.links) setLinks(res.links);
              })
            }
          >
            <Send aria-hidden /> {pending ? "جارٍ الإرسال…" : "إرسال الدعوات للمستخدمين الجدد"}
          </Button>
        }
      />
      {(message || links) && (
        <CardBody className="space-y-2.5">
          {message && <Alert tone={message.ok ? "g" : "r"}>{message.text}</Alert>}
          {links && links.length > 0 && (
            <>
              <Alert tone="i">تم تسجيل رسائل البريد الإلكتروني في قائمة الصادر. تظهر هذه الروابط مرة واحدة فقط — يرجى نسخها الآن في حال إرسالها يدوياً.</Alert>
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {links.map((l) => (
                  <div key={l.userId} className="rounded-base border border-bd1 p-2">
                    <div className="mb-1 text-sm">
                      <b>{l.name}</b> <span dir="ltr" className="text-xs text-tx3">{l.email}</span>
                    </div>
                    <CopyLink link={l.link} />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      )}
    </Card>
  );
}
