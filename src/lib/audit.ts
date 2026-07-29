import { prisma } from "./prisma";
import { AuditAction, AuditResourceType } from "@prisma/client";

interface AuditLogParams {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  description: string;
  performedBy: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failed";
  errorMessage?: string;
}

export async function logAudit(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        description: params.description,
        performedBy: params.performedBy,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        status: params.status || "success",
        errorMessage: params.errorMessage,
      },
    });
  } catch (err) {
    console.error("Failed to log audit:", err);
    // Don't throw — audit logging failures shouldn't break the request
  }
}

export function getClientInfo(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ip, userAgent };
}
