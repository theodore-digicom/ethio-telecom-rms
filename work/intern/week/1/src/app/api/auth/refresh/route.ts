import { z } from "zod";
import { rotateRefreshToken } from "@/lib/session";
import { handler, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ refreshToken: z.string().min(1) });

// POST /api/auth/refresh — exchange a valid refresh token for a new access + refresh pair.
// The old refresh token is rotated (revoked) on success.
export const POST = handler(async (req) => {
  const { refreshToken } = await parseBody(req, schema);
  const result = await rotateRefreshToken(refreshToken);
  return ok(result);
});
