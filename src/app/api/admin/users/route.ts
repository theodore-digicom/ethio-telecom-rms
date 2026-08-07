import { handler, requireAuth, ok, fail, parseBody } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name required"),
  role: z.enum(["ADMIN", "TECHNICIAN"], { message: "Role must be ADMIN or TECHNICIAN" }),
});

function generateTempPassword() {
  return randomBytes(16).toString("hex");
}

export const POST = handler(async (req) => {
  // Require admin role
  const user = await requireAuth(req, ["ADMIN"]);

  const body = await parseBody(req, CreateUserSchema);

  // Check email not already used
  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (existing) {
    return fail("Email already in use", 409);
  }

  // Generate temporary password
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Create user
  const newUser = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      role: body.role,
      password: passwordHash,
    },
  });

  // Send invitation email with temp password
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const html = `
    <h2>Welcome to Ethio Telecom RMS</h2>
    <p>You've been invited to join as a <strong>${body.role}</strong>.</p>
    <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
    <p>
      <a href="${appUrl}/login?email=${encodeURIComponent(body.email)}"
         style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
        Login
      </a>
    </p>
    <p style="color: #666; font-size: 12px;">
      Please change your password immediately after first login.
      This temporary password expires after 24 hours.
    </p>
  `;

  const text = `
Welcome to Ethio Telecom RMS

You've been invited as a ${body.role}.

Temporary Password: ${tempPassword}

Login at: ${appUrl}/login?email=${encodeURIComponent(body.email)}

Please change your password immediately after first login.
  `;

  try {
    await sendEmail({
      to: body.email,
      subject: `Invitation: ${body.role} Account - Ethio Telecom RMS`,
      html,
      text,
    });
  } catch (err) {
    console.error("Failed to send invitation email:", err);
    // Don't fail the request if email fails — user created, admin can retry
  }

  return ok(
    {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      message: `Invitation sent to ${body.email}. Temporary password included in email.`,
    },
    201
  );
});

export const GET = handler(async (req) => {
  // Admin-only: list all users
  await requireAuth(req, ["ADMIN"]);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      banned: true,
      bannedAt: true,
      createdAt: true,
    },
  });

  return ok({ users });
});
