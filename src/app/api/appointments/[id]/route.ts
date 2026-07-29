import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["RESERVED", "COMPLETED", "CANCELLED"]),
});

// PATCH /api/appointments/:id — cancel (owner) or complete (staff).
export const PATCH = handler(async (req, ctx: Ctx) => {
  const auth = await requireAuth(req);
  const { id } = await ctx.params;
  const { status } = await parseBody(req, schema);

  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw new HttpError("Appointment not found", 404);

  const isOwner = appt.userId === auth.sub;
  const isStaff = auth.role === "ADMIN" || auth.role === "TECHNICIAN";
  if (!isOwner && !isStaff) throw new HttpError("Forbidden", 403);
  if (!isStaff && status !== "CANCELLED") {
    throw new HttpError("Customers can only cancel appointments", 403);
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status },
  });
  return ok(updated);
});
