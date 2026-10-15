import "server-only";
import type { SessionUser } from "@/features/auth/auth.types";
import { countUnread, listRecent, markAllRead } from "./notifications.repo";

export async function getNotificationsSummary(user: SessionUser) {
  const [unread, items] = await Promise.all([countUnread(user.id), listRecent(user.id)]);
  return { unread, items };
}

export async function markAllNotificationsRead(user: SessionUser): Promise<void> {
  await markAllRead(user.id);
}
