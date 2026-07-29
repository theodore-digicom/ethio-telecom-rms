import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-please-32chars",
);
const ALG = "HS256";
// Short-lived access token; long-lived refresh token is stored (hashed) in the DB.
const ACCESS_TTL = "15m";
export const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS ?? 30);

export type JwtPayload = {
  sub: string; // user id
  email: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

/** Generate a new opaque refresh token (raw) and its sha256 hash for storage. */
export function newRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(48).toString("base64url");
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Extract + verify the bearer token from a request. Returns null if absent/invalid. */
export async function getAuth(req: NextRequest): Promise<JwtPayload | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyToken(header.slice(7));
}
