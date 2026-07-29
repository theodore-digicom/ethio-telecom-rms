import { handler, requireAuth, ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAudit, getClientInfo } from "@/lib/audit";

export const POST = handler(async (req, { params }) => {
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  if (userId === admin.sub) {
    return fail("Cannot ban yourself", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  if (user.banned) {
    return fail("User already banned", 400);
  }

  // Ban user and revoke all sessions
  const banned = await prisma.user.update({
    where: { id: userId },
    data: { banned: true, bannedAt: new Date() },
    select: { id: true, email: true, banned: true, bannedAt: true },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });

  const { ip, userAgent } = getClientInfo(req);
  await logAudit({
    action: "USER_BANNED",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} banned user ${user.email}`,
    performedBy: admin.sub,
    ipAddress: ip,
    userAgent,
  });

  // Send notification email
  await sendEmail({
    to: user.email,
    subject: "Account Banned - Ethio Telecom RMS",
    text: `Your account has been banned. Please contact support if you believe this is an error.`,
    html: `<p>Your account has been banned.</p><p>Please contact support if you believe this is an error.</p>`,
  }).catch(() => null);

  return ok({ user: banned });
});
