"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { markAllNotificationsRead } from "./notifications.service";

export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user);
  refresh();
}
