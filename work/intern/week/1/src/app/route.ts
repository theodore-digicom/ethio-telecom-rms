import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Root index — lists available API endpoints.
export function GET() {
  return NextResponse.json({
    service: "Ethio Telecom Report Management System — API",
    version: "0.1.0",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register a customer (returns accessToken + refreshToken)",
        "POST /api/auth/login": "Login (returns accessToken + refreshToken)",
        "POST /api/auth/refresh": "Exchange refreshToken for a new token pair",
        "POST /api/auth/logout": "Revoke a refresh token ({refreshToken} or {allDevices:true})",
        "POST /api/auth/forgot-password": "Request a password reset token",
        "POST /api/auth/reset-password": "Reset password with token",
        "POST /api/auth/change-password": "Change password (logged in)",
        "GET /api/auth/me": "Current user (Bearer access token)",
        "PATCH /api/auth/me": "Update own profile (name/phone/email)",
        "DELETE /api/auth/me": "Delete own account",
      },
      tickets: {
        "POST /api/tickets": "Report an internet problem",
        "GET /api/tickets": "List tickets (scoped by role)",
        "GET /api/tickets/:id": "Ticket detail + queue info",
        "GET /api/tickets/:id/queue": "Live queue position + ETA",
        "PATCH /api/tickets/:id": "Update/cancel ticket",
        "POST /api/tickets/:id/assign": "Admin: assign technician",
        "POST /api/tickets/:id/resolve": "Staff: mark fixed",
        "POST /api/tickets/:id/review": "Customer: review service",
      },
      appointments: {
        "POST /api/appointments": "Reserve a branch support slot",
        "GET /api/appointments": "List appointments",
        "PATCH /api/appointments/:id": "Cancel/complete appointment",
      },
      other: {
        "GET /api/technicians": "Admin: technicians + workload",
        "GET /api/notifications": "Current user notifications",
        "PATCH /api/notifications/:id": "Mark notification read",
        "GET /api/admin/queue": "Admin: full ordered queue",
        "GET /api/health": "Health check",
      },
    },
  });
}
