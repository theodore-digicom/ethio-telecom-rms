import { randomBytes, createHash } from "crypto";

const RESET_TTL_MINUTES = Number(process.env.RESET_TTL_MINUTES ?? 60);

/** Opaque single-use password-reset token (raw is emailed, hash is stored). */
export function newResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function resetExpiry(): Date {
  return new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
}
