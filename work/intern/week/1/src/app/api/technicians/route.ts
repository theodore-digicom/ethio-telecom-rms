import { prisma } from "@/lib/prisma";
import { handler, ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/technicians — admin lists technicians with their active workload.
export const GET = handler(async (req) => {
  await requireAuth(req, ["ADMIN"]);

  const techs = await prisma.user.findMany({
    where: { role: "TECHNICIAN" },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          assignedTasks: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const shaped = techs.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    activeTickets: t._count.assignedTasks,
  }));

  return ok(shaped);
});
