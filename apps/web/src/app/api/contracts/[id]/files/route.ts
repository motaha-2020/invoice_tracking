import { getCurrentUser } from "@/features/auth/session";
import { uploadContractFile } from "@/features/contracts/contract-edit.service";
import { isAppError, toArabicMessage } from "@/lib/errors";

/** رفع مرفق للعقد أو لأحد أوامر تكليفه (الشئون الفنية / مدير النظام). multipart: file + kind + note [+ aoId] */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
  const { id } = await params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ ok: false, message: "يرجى اختيار ملف" }, { status: 400 });
    const note = form.get("note");
    const aoId = form.get("aoId");
    await uploadContractFile(user, id, file, form.get("kind"), typeof note === "string" ? note : null, typeof aoId === "string" && aoId ? aoId : null);
    return Response.json({ ok: true });
  } catch (e) {
    if (!isAppError(e)) console.error("[contract-files:upload]", e);
    const status = isAppError(e) ? (e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400) : 500;
    return Response.json({ ok: false, message: toArabicMessage(e) }, { status });
  }
}
