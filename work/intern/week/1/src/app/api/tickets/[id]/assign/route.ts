import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ technicianId: z.string().min(1) });

// POST /api/tickets/:id/assign — admin assigns a technician to a queued ticket.
export const POST = handler(async (req, ctx: Ctx) => {
  await requireAuth(req, ["ADMIN"]);
  const { id } = await ctx.params;
  const { technicianId } = await parseBody(req, schema);

  const [ticket, tech] = await Promise.all([
    prisma.ticket.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: technicianId } }),
  ]);
  if (!ticket) throw new HttpError("Ticket not found", 404);
  if (!tech || tech.role !== "TECHNICIAN") {
    throw new HttpError("Technician not found", 404);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      technicianId,
      status: ticket.status === "OPEN" ? "ASSIGNED" : ticket.status,
    },
  });

  await notify(
    ticket.customerId,
    `Ticket ${ticket.ticketNumber} assigned to technician ${tech.name}.`,
    ticket.id,
  );
  await notify(
    technicianId,
    `You have been assigned ticket ${ticket.ticketNumber}.`,
    ticket.id,
  );

  return ok(updated);
});
