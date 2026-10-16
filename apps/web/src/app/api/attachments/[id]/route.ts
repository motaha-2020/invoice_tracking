import { getCurrentUser } from "@/features/auth/session";
import { deleteAttachment, readAttachment } from "@/features/invoices/attachments.service";
import { isAppError, toArabicMessage } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

/** تنزيل مرفق — لأي مستخدم المستخلص في نطاقه */
export async function GET(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return new Response("يرجى تسجيل الدخول أولاً", { status: 401 });
  const { id } = await params;
  try {
    const f = await readAttachment(user, id);
    return new Response(new Uint8Array(f.data), {
      headers: {
        "Content-Type": f.mimeType,
        "Content-Length": String(f.data.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (!isAppError(e)) console.error("[attachments:download]", e);
    return new Response(toArabicMessage(e), { status: isAppError(e) && e.code === "NOT_FOUND" ? 404 : 500 });
  }
}

/** حذف مرفق (المقاول، من النسخة القابلة للتعديل بس) */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteAttachment(user, id);
    return Response.json({ ok: true });
  } catch (e) {
    if (!isAppError(e)) console.error("[attachments:delete]", e);
    return Response.json({ ok: false, message: toArabicMessage(e) }, { status: isAppError(e) ? 400 : 500 });
  }
}
