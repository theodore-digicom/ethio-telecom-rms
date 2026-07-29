import { handler, requireAuth, ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientInfo } from "@/lib/audit";

export const POST = handler(async (req, { params }) => {
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  const unbanned = await prisma.user.update({
    where: { id: userId },
    data: { banned: false, bannedAt: null },
    select: { id: true, email: true, banned: true, role: true },
  });

  const { ip, userAgent } = getClientInfo(req);
  await logAudit({
    action: "USER_UNBANNED",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} unbanned user ${user.email}`,
    performedBy: admin.sub,
    ipAddress: ip,
    userAgent,
  });

  return ok({ user: unbanned });
});
