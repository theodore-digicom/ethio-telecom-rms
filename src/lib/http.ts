import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getAuth, JwtPayload } from "./auth";
import type { Role } from "@prisma/client";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/** Parse + validate a JSON body against a zod schema. Throws HttpError on failure. */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError("Invalid JSON body", 400);
  }
  try {
    return schema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new HttpError("Validation failed", 422, e.flatten());
    }
    throw e;
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Require a valid token. Optionally restrict to given roles. Throws HttpError otherwise. */
export async function requireAuth(
  req: NextRequest,
  roles?: Role[],
): Promise<JwtPayload> {
  const auth = await getAuth(req);
  if (!auth) throw new HttpError("Unauthorized", 401);
  if (roles && !roles.includes(auth.role)) {
    throw new HttpError("Forbidden", 403);
  }
  return auth;
}

/** Wrap a route handler so thrown HttpErrors become clean JSON responses. */
export function handler(
  fn: (req: NextRequest, ctx: any) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status, e.details);
      console.error(e);
      return fail("Internal server error", 500);
    }
  };
}
