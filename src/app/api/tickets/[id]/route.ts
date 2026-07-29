import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";
import { getQueueInfo } from "@/lib/queue";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      technician: { select: { id: true, name: true } },
      review: true,
    },
  });
  if (!ticket) throw new HttpError("Ticket not found", 404);
  return ticket;
}

// GET /api/tickets/:id — ticket detail with live queue position + ETA.
export const GET = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;
  const ticket = await loadTicket(id);

  if (auth.role === "CUSTOMER" && ticket.customerId !== auth.sub) {
    throw new HttpError("Forbidden", 403);
  }

  const queue = await getQueueInfo(ticket);
  return ok({ ...ticket, queue });
});

const updateSchema = z.object({
  status: z
    .enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  description: z.string().min(5).optional(),
});

// PATCH /api/tickets/:id — customer may cancel/edit own open ticket; staff may change status/priority.
export const PATCH = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, updateSchema);
  const ticket = await loadTicket(id);

  const isOwner = ticket.customerId === auth.sub;
  const isStaff = auth.role === "ADMIN" || auth.role === "TECHNICIAN";

  if (!isStaff && !isOwner) throw new HttpError("Forbidden", 403);

  // Customers can only cancel or edit description of a still-open ticket.
  if (!isStaff) {
    if (body.status && body.status !== "CANCELLED") {
      throw new HttpError("Customers can only cancel a ticket", 403);
    }
    if (ticket.status !== "OPEN") {
      throw new HttpError("Ticket can no longer be edited by the customer", 409);
    }
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.priority && isStaff) data.priority = body.priority;
  if (body.description) data.description = body.description;
  if (body.status === "RESOLVED") data.resolvedAt = new Date();

  const updated = await prisma.ticket.update({ where: { id }, data });

  if (body.status && body.status !== ticket.status) {
    await notify(
      ticket.customerId,
      `Ticket ${ticket.ticketNumber} status changed to ${body.status}.`,
      ticket.id,
    );
  }

  return ok(updated);
});
