import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// POST /api/tickets/:id/review — customer rates the service after resolution.
export const POST = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { review: true },
  });
  if (!ticket) throw new HttpError("Ticket not found", 404);
  if (ticket.customerId !== auth.sub) throw new HttpError("Forbidden", 403);
  if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
    throw new HttpError("You can only review a resolved ticket", 409);
  }
  if (ticket.review) throw new HttpError("Ticket already reviewed", 409);

  const review = await prisma.review.create({
    data: {
      ticketId: id,
      userId: auth.sub,
      rating: body.rating,
      comment: body.comment,
    },
  });

  // Reviewing closes the ticket.
  await prisma.ticket.update({ where: { id }, data: { status: "CLOSED" } });

  return ok(review, 201);
});
