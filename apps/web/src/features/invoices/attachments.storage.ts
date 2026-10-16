import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * تخزين المرفقات على القرص (UPLOAD_DIR — على السيرفر volume اسمه uploads على /data/uploads).
 * المسار المخزن في DB نسبي (yyyy/mm/<عشوائي>.<امتداد>)، واسم الملف الأصلي في DB بس — مفيش اسم من المستخدم على القرص.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** الامتدادات المسموحة ونوع المحتوى (ما بنثقش في نوع المتصفح) */
export const ALLOWED_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  zip: "application/zip",
  dwg: "application/acad",
  kmz: "application/vnd.google-earth.kmz",
  kml: "application/vnd.google-earth.kml+xml",
};

function root(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads"));
}

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/** المسار الكامل لملف — بيرفض أي مسار بيطلع برّه UPLOAD_DIR */
function resolve(rel: string): string {
  const base = root();
  const full = path.resolve(/*turbopackIgnore: true*/ base, rel);
  if (!full.startsWith(base + path.sep)) throw new Error("invalid storage path");
  return full;
}

export async function saveFile(data: Buffer, fileName: string): Promise<{ storagePath: string; sha256: string; mimeType: string }> {
  const ext = extOf(fileName);
  const mimeType = ALLOWED_TYPES[ext];
  if (!mimeType) throw new Error("type not allowed");
  const now = new Date();
  const rel = path.posix.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), `${randomBytes(16).toString("hex")}.${ext}`);
  const full = resolve(rel);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ full, data, { flag: "wx" });
  return { storagePath: rel, sha256: createHash("sha256").update(data).digest("hex"), mimeType };
}

export function readStoredFile(rel: string): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ resolve(rel));
}

export async function removeStoredFile(rel: string): Promise<void> {
  await rm(/*turbopackIgnore: true*/ resolve(rel), { force: true });
}
