import { prisma } from "./prisma";
import {
  signToken,
  newRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from "./auth";
import { HttpError } from "./http";
import type { User } from "@prisma/client";

/** Issue an access token + a fresh persisted refresh token for a user. */
export async function issueTokens(
  user: Pick<User, "id" | "email" | "role">,
) {
  const accessToken = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const { raw, hash } = newRefreshToken();
  await prisma.refreshToken.create({
    data: { tokenHash: hash, userId: user.id, expiresAt: refreshExpiry() },
  });

  return { accessToken, refreshToken: raw };
}

/**
 * Validate a raw refresh token, rotate it (revoke old + issue new), and return
 * a new access + refresh pair. Throws HttpError(401) if invalid/expired/revoked.
 */
export async function rotateRefreshToken(raw: string) {
  const hash = hashRefreshToken(raw);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });

  if (
    !record ||
    record.revokedAt ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new HttpError("Invalid or expired refresh token", 401);
  }

  // Rotate: revoke the used token, then issue a new pair in one transaction.
  const { raw: newRaw, hash: newHash } = newRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: newHash,
        userId: record.userId,
        expiresAt: refreshExpiry(),
      },
    }),
  ]);

  const accessToken = await signToken({
    sub: record.user.id,
    email: record.user.email,
    role: record.user.role,
  });

  return {
    accessToken,
    refreshToken: newRaw,
    user: {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      role: record.user.role,
    },
  };
}

/** Revoke a single refresh token (logout). No error if it's already gone. */
export async function revokeRefreshToken(raw: string) {
  const hash = hashRefreshToken(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every active refresh token for a user (logout everywhere). */
export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
