import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth } from "@/lib/http";
import { makeTicketNumber } from "@/lib/queue";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

const createSchema = z.object({
  subject: z.string().min(3).max(120), // short summary
  serviceNumber: z.string().min(3).max(40).optional(), // Ethio Telecom line/account no.
  category: z.string().min(2), // NO_CONNECTION, SLOW_SPEED, ROUTER, BILLING, OTHER
  description: z.string().min(5),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

// POST /api/tickets — customer reports an internet problem, gets a digital ticket.
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await parseBody(req, createSchema);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: makeTicketNumber(),
      subject: body.subject,
      serviceNumber: body.serviceNumber,
      category: body.category,
      description: body.description,
      priority: body.priority ?? "MEDIUM",
      customerId: auth.sub,
    },
  });

  await notify(
    auth.sub,
    `Ticket ${ticket.ticketNumber} created and added to the queue.`,
    ticket.id,
  );

  return ok(ticket, 201);
});

// GET /api/tickets — list tickets. Customers see their own; staff see all (filterable by ?status=).
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const status = new URL(req.url).searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> = {};
  if (auth.role === "CUSTOMER") where.customerId = auth.sub;
  if (auth.role === "TECHNICIAN") where.technicianId = auth.sub;
  if (status) where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      technician: { select: { id: true, name: true } },
    },
  });

  return ok(tickets);
});
