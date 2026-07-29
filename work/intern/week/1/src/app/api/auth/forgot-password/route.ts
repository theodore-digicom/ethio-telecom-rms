import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { newResetToken, resetExpiry } from "@/lib/password";
import { notify } from "@/lib/notify";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { handler, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

// POST /api/auth/forgot-password — request a reset link/token.
// Always returns the same generic response to avoid leaking which emails exist.
export const POST = handler(async (req) => {
  const { email } = await parseBody(req, schema);
  const user = await prisma.user.findUnique({ where: { email } });

  const response: Record<string, unknown> = {
    message: "If that email exists, a reset link has been sent.",
  };

  if (user) {
    const { raw, hash } = newResetToken();
    await prisma.passwordResetToken.create({
      data: { tokenHash: hash, userId: user.id, expiresAt: resetExpiry() },
    });
    await notify(user.id, "A password reset was requested for your account.");

    // Email the token via Resend.
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${raw}`;
    const sent = await sendEmail({ to: user.email, ...passwordResetEmail(resetUrl, raw) });

    // Fallback for local dev when Resend isn't configured yet — expose the token so
    // the flow stays testable. Never returned once email delivery succeeds / in prod.
    if (!sent && process.env.NODE_ENV !== "production") {
      response.devResetToken = raw;
    }
  }

  return ok(response);
});
