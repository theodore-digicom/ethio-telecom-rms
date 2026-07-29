import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth, HttpError } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/notifications/:id — mark a notification as read.
export const PATCH = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== auth.sub) {
    throw new HttpError("Notification not found", 404);
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return ok(updated);
});
