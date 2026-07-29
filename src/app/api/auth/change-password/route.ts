import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { revokeAllForUser } from "@/lib/session";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// POST /api/auth/change-password — logged-in user changes their own password.
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const { currentPassword, newPassword } = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { id: auth.sub } });
  if (!user) throw new HttpError("User not found", 404);
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw new HttpError("Current password is incorrect", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(newPassword) },
  });

  // Force re-login on other devices after a credential change.
  await revokeAllForUser(user.id);

  return ok({ message: "Password changed. Other sessions were logged out." });
});
