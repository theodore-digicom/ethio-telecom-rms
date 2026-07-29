import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { issueTokens } from "@/lib/session";
import { handler, ok, parseBody, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(6),
  // Only CUSTOMER self-registration is allowed here; staff are seeded/created by admin.
});

export const POST = handler(async (req) => {
  const body = await parseBody(req, schema);

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });
  if (existing) throw new HttpError("Email already registered", 409);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: await hashPassword(body.password),
      role: "CUSTOMER",
    },
  });

  const tokens = await issueTokens(user);

  return ok(
    {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
    201,
  );
});
