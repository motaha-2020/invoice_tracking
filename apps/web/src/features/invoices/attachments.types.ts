/** ثوابت المرفقات للمتصفح (client-safe) — نفس قائمة attachments.storage.ts */
export const ALLOWED_ACCEPT_CLIENT = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.zip,.dwg,.kmz,.kml";

export function fileSizeLabel(b: number): string {
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}
