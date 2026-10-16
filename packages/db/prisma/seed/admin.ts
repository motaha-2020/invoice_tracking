// أول Admin: من ADMIN_EMAIL + ADMIN_NAME، من غير كلمة سر.
// بيتعمل له رابط دعوة (InviteToken purpose=invite صالح 72 ساعة) والتوكن الخام بيتطبع مرة واحدة بس.
// تشغيله تاني:
//  - لو الـ Admin فعّل حسابه (عنده كلمة سر) ← مفيش حاجة بتحصل.
//  - لو عنده دعوة لسه صالحة ← مفيش توكن جديد (إلا لو ADMIN_REISSUE=1، والقديمة بتتلغي).
import type { PrismaClient } from '../../src/index';
import { hashToken, newToken } from './crypto';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export async function seedAdmin(db: PrismaClient): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  if (!email) {
    console.log('  • admin: لم يُحدَّد ADMIN_EMAIL — تم تخطي إنشاء حساب مدير النظام الأول');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`قيمة ADMIN_EMAIL ليست بريداً إلكترونياً صحيحاً: ${email}`);
  if (!name) throw new Error('يجب تحديد ADMIN_NAME مع ADMIN_EMAIL');

  const user =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.create({ data: { email, name, active: true } }));

  const hasAdminRole = await db.userRole.findFirst({
    where: { userId: user.id, role: 'admin', scopeType: 'all', scopeId: null },
  });
  if (!hasAdminRole) {
    await db.userRole.create({ data: { userId: user.id, role: 'admin', scopeType: 'all', scopeId: null } });
  }

  if (user.passwordHash) {
    console.log(`  • admin: الحساب ${email} مفعّل بالفعل — لن تُنشأ دعوة جديدة`);
    return;
  }

  const now = new Date();
  const pending = await db.inviteToken.findFirst({
    where: { userId: user.id, purpose: 'invite', usedAt: null, expiresAt: { gt: now } },
  });
  if (pending && process.env.ADMIN_REISSUE !== '1') {
    console.log(`  • admin: للحساب ${email} دعوة سارية حتى ${pending.expiresAt.toISOString()}`);
    console.log('           (في حال فقدان الرمز: يرجى إعادة التشغيل مع ADMIN_REISSUE=1)');
    return;
  }

  const token = newToken();
  await db.$transaction([
    // أي دعوة قديمة مش مستخدمة بتتقفل عشان يفضل رابط واحد بس شغال
    db.inviteToken.updateMany({
      where: { userId: user.id, purpose: 'invite', usedAt: null },
      data: { usedAt: now },
    }),
    db.inviteToken.create({
      data: { id: hashToken(token), userId: user.id, purpose: 'invite', expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
    }),
  ]);

  const base = process.env.APP_URL?.replace(/\/+$/, '');
  console.log('');
  console.log('  ┌─ دعوة مدير النظام الأول (تظهر مرة واحدة فقط — يرجى نسخها الآن) ─');
  console.log(`  │ email : ${email}`);
  console.log(`  │ token : ${token}`);
  if (base) console.log(`  │ link  : ${base}/invite/${token}`);
  console.log('  │ صالحة لمدة 72 ساعة');
  console.log('  └──────────────────────────────────────────────');
}
