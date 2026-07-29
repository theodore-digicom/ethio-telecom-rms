import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, requireAuth, HttpError } from "@/lib/http";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

const schema = z.object({
  branch: z.string().min(2),
  slotTime: z.string().datetime(), // ISO 8601
  notes: z.string().max(500).optional(),
});

// POST /api/appointments — reserve a support slot at a branch before visiting.
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await parseBody(req, schema);

  const slot = new Date(body.slotTime);
  if (slot.getTime() < Date.now()) {
    throw new HttpError("Slot time must be in the future", 422);
  }

  // Prevent double-booking the exact same branch slot.
  const clash = await prisma.appointment.findFirst({
    where: { branch: body.branch, slotTime: slot, status: "RESERVED" },
  });
  if (clash) throw new HttpError("That slot is already reserved", 409);

  const appt = await prisma.appointment.create({
    data: {
      userId: auth.sub,
      branch: body.branch,
      slotTime: slot,
      notes: body.notes,
    },
  });

  await notify(
    auth.sub,
    `Appointment reserved at ${body.branch} for ${slot.toISOString()}.`,
  );

  return ok(appt, 201);
});

// GET /api/appointments — list own appointments (staff see all).
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const where = auth.role === "CUSTOMER" ? { userId: auth.sub } : {};
  const appts = await prisma.appointment.findMany({
    where,
    orderBy: { slotTime: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return ok(appts);
});
