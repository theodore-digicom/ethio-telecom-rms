import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth, HttpError } from "@/lib/http";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/tickets/:id/resolve — technician/admin marks a ticket fixed.
export const POST = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req, ["ADMIN", "TECHNICIAN"]);
  const { id } = await ctx.params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new HttpError("Ticket not found", 404);

  // A technician may only resolve tickets assigned to them.
  if (auth.role === "TECHNICIAN" && ticket.technicianId !== auth.sub) {
    throw new HttpError("This ticket is not assigned to you", 403);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  await notify(
    ticket.customerId,
    `Ticket ${ticket.ticketNumber} has been marked as fixed. Please review the service.`,
    ticket.id,
  );

  return ok(updated);
});
