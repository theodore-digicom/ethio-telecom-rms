import { handler, requireAuth, ok, fail, parseBody } from "@/lib/http";
import { hashPassword, signToken, newRefreshToken } from "@/lib/auth";
import { hashRefreshToken, issueTokens } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientInfo } from "@/lib/audit";
import { z } from "zod";
import { randomBytes } from "crypto";

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
      banned: true,
      bannedAt: true,
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
      banned: true,
    },
  });

  const { ip, userAgent } = getClientInfo(req);
  const changes = Object.keys(body).reduce(
    (acc, key) => {
      if (body[key] !== user[key]) {
        acc[key] = { from: user[key], to: body[key] };
      }
      return acc;
    },
    {} as Record<string, any>
  );

  await logAudit({
    action: "USER_UPDATED",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} updated user ${user.email}`,
    performedBy: admin.id,
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

  if (userId === admin.id) {
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
    performedBy: admin.id,
    ipAddress: ip,
    userAgent,
  });

  return ok({ message: `User ${user.email} deleted` });
});
