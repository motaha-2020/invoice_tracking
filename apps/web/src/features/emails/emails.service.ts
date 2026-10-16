import "server-only";
import type { EmailStatus } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { hasRole } from "@/features/auth/scope";
import { AppError } from "@/lib/errors";
import { getSmtpConfig } from "./mailer";
import * as repo from "./outbox.repo";

/** سجل البريد الإلكتروني — PMO و Admin بس (زي القائمة) */
function assertView(user: SessionUser) {
  if (!hasRole(user, "pmo", "admin")) throw new AppError("FORBIDDEN");
}

export async function getOutbox(user: SessionUser, filter: { status?: EmailStatus; q?: string }) {
  assertView(user);
  const q = filter.q?.trim();
  const [rows, counts] = await Promise.all([
    repo.listOutbox({
      ...(filter.status ? { status: filter.status } : {}),
      ...(q ? { OR: [{ toEmail: { contains: q, mode: "insensitive" } }, { toName: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] } : {}),
    }),
    repo.countByStatus(),
  ]);
  const s = await getSmtpConfig();
  return { rows, counts, smtp: { configured: !!s && !s.passwordBroken, host: s?.host ?? "", from: s?.from ?? "" } };
}

export async function requeueFailed(user: SessionUser, ids: string[] | "allFailed"): Promise<number> {
  assertView(user);
  return repo.requeue(ids, user.id);
}
