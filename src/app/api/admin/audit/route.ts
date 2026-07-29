import { handler, requireAuth, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const GET = handler(async (req) => {
  // Admin-only: view audit logs
  await requireAuth(req, ["ADMIN"]);

  const url = new URL(req.url);
  const skip = parseInt(url.searchParams.get("skip") || "0");
  const take = Math.min(parseInt(url.searchParams.get("take") || "50"), 500);
  const userId = url.searchParams.get("userId");
  const action = url.searchParams.get("action");

  const where: any = {};
  if (userId) where.performedBy = userId;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        description: true,
        performedByUser: { select: { email: true, name: true } },
        ipAddress: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({
    logs,
    pagination: {
      skip,
      take,
      total,
      pages: Math.ceil(total / take),
    },
  });
});
