// Email delivery via Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
// Uses fetch — no SDK dependency. RESEND_API_KEY is provisioned by the Vercel
// Resend integration; EMAIL_FROM is the verified sender.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send an email through Resend. If RESEND_API_KEY is not configured (e.g. local
 * dev before the integration is wired), it logs and returns false instead of throwing
 * so auth flows keep working with the dev token fallback.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@theo.et";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipped email to ${to} ("${subject}")`);
    return false;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Resend send failed (${res.status}): ${detail}`);
    return false;
  }
  return true;
}

export function passwordResetEmail(resetUrl: string, rawToken: string) {
  return {
    subject: "Reset your Ethio Telecom RMS password",
    text: `You requested a password reset.\n\nReset token: ${rawToken}\n\nOr open: ${resetUrl}\n\nThis link expires in 60 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password reset</h2>
        <p>You requested a password reset for your Ethio Telecom Report Management account.</p>
        <p><a href="${resetUrl}" style="background:#0a7d2e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p>
        <p>Or use this token:<br><code>${rawToken}</code></p>
        <p style="color:#666;font-size:13px">This link expires in 60 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
  };
}
