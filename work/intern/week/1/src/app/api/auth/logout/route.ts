import { z } from "zod";
import { revokeRefreshToken, revokeAllForUser } from "@/lib/session";
import { handler, ok, parseBody, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  refreshToken: z.string().min(1).optional(),
  allDevices: z.boolean().optional(),
});

// POST /api/auth/logout — revoke a refresh token.
// Body { refreshToken } revokes that token; { allDevices: true } (with Bearer access
// token) revokes every active refresh token for the user.
export const POST = handler(async (req) => {
  const body = await parseBody(req, schema);

  if (body.allDevices) {
    const auth = await requireAuth(req);
    await revokeAllForUser(auth.sub);
    return ok({ loggedOut: "all-devices" });
  }

  if (body.refreshToken) {
    await revokeRefreshToken(body.refreshToken);
  }
  return ok({ loggedOut: true });
});
