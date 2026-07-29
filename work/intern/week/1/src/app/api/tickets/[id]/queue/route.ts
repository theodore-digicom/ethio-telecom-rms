import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth, HttpError } from "@/lib/http";
import { getQueueInfo } from "@/lib/queue";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/tickets/:id/queue — real-time queue position, people ahead, estimated wait.
export const GET = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new HttpError("Ticket not found", 404);
  if (auth.role === "CUSTOMER" && ticket.customerId !== auth.sub) {
    throw new HttpError("Forbidden", 403);
  }

  const queue = await getQueueInfo(ticket);
  return ok({
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    ...queue,
  });
});
