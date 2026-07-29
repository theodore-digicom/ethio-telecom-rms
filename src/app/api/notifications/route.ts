import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/notifications — current user's notifications (newest first). ?unread=1 to filter.
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const unread = new URL(req.url).searchParams.get("unread") === "1";

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.sub, ...(unread ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(notifications);
});
