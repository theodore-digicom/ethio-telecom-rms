import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password";
import { hashPassword } from "@/lib/auth";
import { revokeAllForUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import { handler, ok, parseBody, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

// POST /api/auth/reset-password — consume a reset token and set a new password.
// Single-use; on success all existing refresh tokens are revoked (log out everywhere).
export const POST = handler(async (req) => {
  const { token, newPassword } = await parseBody(req, schema);
  const hash = hashResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError("Invalid or expired reset token", 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Invalidate every active session after a password reset.
  await revokeAllForUser(record.userId);
  await notify(record.userId, "Your password was reset. All sessions were logged out.");

  return ok({ message: "Password has been reset. Please log in again." });
});
