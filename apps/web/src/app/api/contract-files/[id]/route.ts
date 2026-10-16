import { getCurrentUser } from "@/features/auth/session";
import { deleteContractFile, readContractFile } from "@/features/contracts/contract-edit.service";
import { isAppError, toArabicMessage } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

/** تنزيل مرفق عقد — لأي مستخدم العقد في نطاقه */
export async function GET(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return new Response("يرجى تسجيل الدخول أولاً", { status: 401 });
  const { id } = await params;
  try {
    const f = await readContractFile(user, id);
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
    if (!isAppError(e)) console.error("[contract-files:download]", e);
    return new Response(toArabicMessage(e), { status: isAppError(e) && e.code === "NOT_FOUND" ? 404 : 500 });
  }
}

/** حذف مرفق عقد (الشئون الفنية / مدير النظام) */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteContractFile(user, id);
    return Response.json({ ok: true });
  } catch (e) {
    if (!isAppError(e)) console.error("[contract-files:delete]", e);
    return Response.json({ ok: false, message: toArabicMessage(e) }, { status: isAppError(e) ? (e.code === "FORBIDDEN" ? 403 : 400) : 500 });
  }
}
