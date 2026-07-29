import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { issueTokens } from "@/lib/session";
import { handler, ok, parseBody, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handler(async (req) => {
  const body = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.password))) {
    throw new HttpError("Invalid email or password", 401);
  }

  const tokens = await issueTokens(user);

  return ok({
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
