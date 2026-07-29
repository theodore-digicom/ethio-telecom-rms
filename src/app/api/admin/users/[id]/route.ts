import { handler, requireAuth, ok, fail, parseBody } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientInfo } from "@/lib/audit";
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN"]).optional(),
  phone: z.string().optional(),
});

const ResetPasswordSchema = z.object({
  sendEmail: z.boolean().default(true),
});

export const GET = handler(async (req, { params }) => {
  // Admin-only: view user details
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return fail("User not found", 404);
  }

  return ok({ user });
});

export const PATCH = handler(async (req, { params }) => {
  // Admin-only: update user
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  const body = await parseBody(req, UpdateUserSchema);

  // Check email uniqueness if changing email
  if (body.email && body.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return fail("Email already in use", 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: body,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
    },
  });

  const { ip, userAgent } = getClientInfo(req);
  const changes: Record<string, any> = {};
  if (body.name !== undefined && body.name !== user.name) {
    changes.name = { from: user.name, to: body.name };
  }
  if (body.email !== undefined && body.email !== user.email) {
    changes.email = { from: user.email, to: body.email };
  }
  if (body.phone !== undefined && body.phone !== user.phone) {
    changes.phone = { from: user.phone, to: body.phone };
  }
  if (body.role !== undefined && body.role !== user.role) {
    changes.role = { from: user.role, to: body.role };
  }

  await logAudit({
    action: "USER_UPDATED",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} updated user ${user.email}`,
    performedBy: admin.sub,
    changes,
    ipAddress: ip,
    userAgent,
  });

  return ok({ user: updated });
});

export const DELETE = handler(async (req, { params }) => {
  // Admin-only: delete user (hard delete with cascading cleanup)
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  if (userId === admin.sub) {
    return fail("Cannot delete yourself", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  // Delete user (cascading deletes tickets, appointments, etc)
  await prisma.user.delete({ where: { id: userId } });

  const { ip, userAgent } = getClientInfo(req);
  await logAudit({
    action: "USER_DELETED",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} deleted user ${user.email}`,
    performedBy: admin.sub,
    ipAddress: ip,
    userAgent,
  });

  return ok({ message: `User ${user.email} deleted` });
});
