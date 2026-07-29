import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

const AVG_HANDLE_MINUTES = Number(process.env.AVG_HANDLE_MINUTES ?? 45);
const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// GET /api/admin/queue — ordered live queue the admin uses to assign technicians.
export const GET = handler(async (req) => {
  await requireAuth(req, ["ADMIN"]);

  const waiting = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      technician: { select: { id: true, name: true } },
    },
  });

  const sorted = waiting.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const queue = sorted.map((t, i) => ({
    position: i + 1,
    estimatedWaitMinutes: i * AVG_HANDLE_MINUTES,
    ...t,
  }));

  return ok({ total: queue.length, queue });
});
