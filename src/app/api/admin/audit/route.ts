import { handler, requireAuth, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const GET = handler(async (req) => {
  const admin = await requireAuth(req, ["ADMIN"]);

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        performedByUser: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  return ok({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
