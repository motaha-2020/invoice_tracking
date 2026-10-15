import { clsx, type ClassValue } from "clsx";

/** دمج الـ classes (شرطية) — wrapper صغير حوالين clsx */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
