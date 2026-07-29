import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revokeAllForUser } from "@/lib/session";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const selectPublic = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

// GET /api/auth/me — current user profile.
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: selectPublic,
  });
  if (!user) throw new HttpError("User not found", 404);
  return ok(user);
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
});

// PATCH /api/auth/me — update own profile (name, phone, email).
export const PATCH = handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await parseBody(req, updateSchema);

  if (body.email) {
    const clash = await prisma.user.findUnique({ where: { email: body.email } });
    if (clash && clash.id !== auth.sub) {
      throw new HttpError("Email already in use", 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: auth.sub },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
    },
    select: selectPublic,
  });
  return ok(user);
});

// DELETE /api/auth/me — delete own account. Blocked while tickets exist so service
// history is preserved (tokens cascade automatically).
export const DELETE = handler(async (req) => {
  const auth = await requireAuth(req);

  const tickets = await prisma.ticket.count({ where: { customerId: auth.sub } });
  if (tickets > 0) {
    throw new HttpError(
      "Cannot delete account with existing tickets. Contact support.",
      409,
    );
  }

  await revokeAllForUser(auth.sub);
  await prisma.user.delete({ where: { id: auth.sub } });
  return ok({ message: "Account deleted" });
});
