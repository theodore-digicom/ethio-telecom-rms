import { handler, requireAuth, ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAudit, getClientInfo } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req, ctx: Ctx) => {
  const user = await requireAuth(req, ["TECHNICIAN", "ADMIN"]);
  const { id: ticketId } = await ctx.params;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { customer: true, technician: true },
  });

  if (!ticket) {
    return fail("Ticket not found", 404);
  }

  // Only technician assigned to ticket (or admin) can reopen
  if (user.role === "TECHNICIAN" && ticket.technicianId !== user.sub) {
    return fail("Forbidden", 403);
  }

  if (ticket.status !== "RESOLVED") {
    return fail("Can only reopen resolved tickets", 400);
  }

  // Reopen: set to IN_PROGRESS
  const reopened = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "IN_PROGRESS",
      resolvedAt: null,
    },
    include: { customer: true, technician: true },
  });

  // Notify customer
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const ticketUrl = `${appUrl}/tickets/${ticket.id}`;
  const html = `
    <h2>Ticket Reopened</h2>
    <p>Your support ticket <strong>${ticket.ticketNumber}</strong> has been reopened.</p>
    <p><strong>Reason:</strong> Further work is needed to resolve your issue.</p>
    <p>Our technician will continue working on it shortly.</p>
    <p>
      <a href="${ticketUrl}"
         style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
        View Ticket
      </a>
    </p>
  `;

  const text = `
Your support ticket ${ticket.ticketNumber} has been reopened.

Our technician will continue working on it shortly.

View ticket: ${ticketUrl}
  `;

  await sendEmail({
    to: ticket.customer.email,
    subject: `Ticket Reopened: ${ticket.ticketNumber}`,
    html,
    text,
  }).catch(() => null);

  // Create notification
  await prisma.notification.create({
    data: {
      userId: ticket.customerId,
      ticketId: ticketId,
      message: `Ticket ${ticket.ticketNumber} has been reopened for further work`,
    },
  });

  const { ip, userAgent } = getClientInfo(req);
  await logAudit({
    action: "USER_UPDATED",
    resourceType: "TICKET",
    resourceId: ticketId,
    description: `${user.role === "TECHNICIAN" ? "Technician" : "Admin"} ${user.email} reopened ticket ${ticket.ticketNumber}`,
    performedBy: user.sub,
    ipAddress: ip,
    userAgent,
    changes: { status: { from: "RESOLVED", to: "IN_PROGRESS" } },
  });

  return ok({
    ticket: {
      id: reopened.id,
      ticketNumber: reopened.ticketNumber,
      status: reopened.status,
      priority: reopened.priority,
      subject: reopened.subject,
      message: "Ticket reopened. Customer notified.",
    },
  });
});
