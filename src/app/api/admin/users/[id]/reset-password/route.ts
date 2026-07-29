import { handler, requireAuth, ok, fail } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientInfo } from "@/lib/audit";
import { randomBytes } from "crypto";

export const POST = handler(async (req, { params }) => {
  const admin = await requireAuth(req, ["ADMIN"]);
  const userId = params.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("User not found", 404);
  }

  // Generate temporary password
  const tempPassword = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(tempPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  });

  // Revoke all refresh tokens (force re-login)
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });

  const { ip, userAgent } = getClientInfo(req);
  await logAudit({
    action: "USER_PASSWORD_RESET",
    resourceType: "USER",
    resourceId: userId,
    description: `Admin ${admin.email} reset password for user ${user.email}`,
    performedBy: admin.id,
    ipAddress: ip,
    userAgent,
  });

  // Send notification email
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const html = `
    <h2>Password Reset by Administrator</h2>
    <p>Your password has been reset by an administrator.</p>
    <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
    <p>
      <a href="${appUrl}/login?email=${encodeURIComponent(user.email)}"
         style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
        Login
      </a>
    </p>
    <p style="color: #666; font-size: 12px;">
      Please change your password immediately after login.
    </p>
  `;

  const text = `
Your password has been reset by an administrator.

Temporary Password: ${tempPassword}

Login at: ${appUrl}/login?email=${encodeURIComponent(user.email)}

Please change your password immediately after login.
  `;

  await sendEmail({
    to: user.email,
    subject: "Password Reset - Ethio Telecom RMS",
    html,
    text,
  }).catch(() => null);

  return ok({
    message: `Password reset for ${user.email}. Temporary password sent via email.`,
    user: { id: user.id, email: user.email },
  });
});
