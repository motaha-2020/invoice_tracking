import { getCurrentUser } from "@/features/auth/session";
import { uploadAttachment } from "@/features/invoices/attachments.service";
import { isAppError, toArabicMessage } from "@/lib/errors";

/** رفع مرفق للمستخلص (المقاول: المسودة أو المستخلص المعاد له). multipart: file + docTypeId */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
  const { id } = await params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const docTypeId = form.get("docTypeId");
    if (!(file instanceof File)) return Response.json({ ok: false, message: "يرجى اختيار ملف" }, { status: 400 });
    const attachment = await uploadAttachment(user, id, file, typeof docTypeId === "string" && docTypeId ? docTypeId : null);
    return Response.json({ ok: true, attachment });
  } catch (e) {
    if (!isAppError(e)) console.error("[attachments:upload]", e);
    const status = isAppError(e) ? (e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400) : 500;
    return Response.json({ ok: false, message: toArabicMessage(e) }, { status });
  }
}
