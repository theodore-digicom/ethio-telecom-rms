import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3055";

async function loginAs(request: any, email: string, password = "password123") {
  const res = await request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok) {
    throw new Error(
      `Login failed for ${email}: ${res.status()} ${await res.text()}`
    );
  }
  const json = await res.json();
  return json.data.accessToken;
}

test.describe("Tickets", () => {
  test("customer creates ticket with subject + serviceNumber", async ({
    request,
  }) => {
    const email = "tkt-create@test.example";
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Ticket Creator", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const token = regData.accessToken;

    const res = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        subject: "No internet since morning",
        serviceNumber: "0911-ETC-8842",
        category: "NO_CONNECTION",
        description: "Line dead, no connectivity",
        priority: "HIGH",
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.subject).toBe("No internet since morning");
    expect(data.serviceNumber).toBe("0911-ETC-8842");
    expect(data.status).toBe("OPEN");
    expect(data.ticketNumber).toMatch(/^ETC-\d{8}-\d{4}$/);
  });

  test("customer sees only own tickets", async ({ request }) => {
    const email = "tkt-owner@test.example";
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Ticket Owner", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const token = regData.accessToken;

    // Create a ticket
    await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        subject: "My ticket",
        category: "SLOW_SPEED",
        description: "Test",
      },
    });

    const res = await request.get(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { data: tickets } = await res.json();
    // All returned tickets should belong to this customer
    tickets.forEach((t: any) => {
      expect(t.customerId).toBe(regData.user.id);
    });
  });

  test("technician sees only assigned tickets", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const techEmail = "tech-viewer@test.example";
    const techReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Tech Viewer", email: techEmail, password: "password123" },
    });

    const custEmail = "cust-for-tech@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Cust For Tech", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    // Create a ticket
    const ticketRes = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Router issue",
        category: "ROUTER",
        description: "Test",
      },
    });
    const { data: ticket } = await ticketRes.json();

    // Assign to technician (need real tech ID from seed)
    const techs = await request.get(`${BASE}/api/technicians`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: techList } = await techs.json();
    const techId = techList[0].id;

    await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { technicianId: techId },
    });

    // Tech sees the ticket
    const techToken = await loginAs(request, "tech@ethiotelecom.et");
    const ticketsList = await request.get(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });
    const { data: ticketsForTech } = await ticketsList.json();
    expect(ticketsForTech.some((t: any) => t.id === ticket.id)).toBeTruthy();
  });

  test("get ticket detail with queue info", async ({ request }) => {
    const email = "tkt-queue@test.example";
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Queue Test", email, password: "password123" },
    });
    const { data: regData } = await reg.json();

    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        subject: "Test queue",
        category: "SLOW_SPEED",
        description: "Testing queue position",
      },
    });
    const { data: ticket } = await create.json();

    const detail = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
    });
    expect(detail.status()).toBe(200);
    const { data } = await detail.json();
    expect(data.queue).toBeDefined();
    expect(data.queue.position).toBeGreaterThan(0);
    expect(data.queue.ahead).toBeDefined();
    expect(data.queue.estimatedWaitMinutes).toBeGreaterThanOrEqual(0);
  });

  test("customer cannot view another's ticket", async ({ request }) => {
    const email1 = "tkt-priv1@test.example";
    const email2 = "tkt-priv2@test.example";

    const reg1 = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Cust1", email: email1, password: "password123" },
    });
    const { data: data1 } = await reg1.json();

    const reg2 = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Cust2", email: email2, password: "password123" },
    });
    const { data: data2 } = await reg2.json();

    // Cust1 creates ticket
    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${data1.accessToken}` },
      data: {
        subject: "Private ticket",
        category: "BILLING",
        description: "My private issue",
      },
    });
    const { data: ticket } = await create.json();

    // Cust2 tries to access
    const access = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
      headers: { Authorization: `Bearer ${data2.accessToken}` },
    });
    expect(access.status()).toBe(403);
  });

  test("admin assigns ticket to technician", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const custEmail = "tkt-assign@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Assign Cust", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Assign test",
        category: "NO_CONNECTION",
        description: "Testing assignment",
      },
    });
    const { data: ticket } = await create.json();

    const techs = await request.get(`${BASE}/api/technicians`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: techList } = await techs.json();

    const assign = await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { technicianId: techList[0].id },
    });
    expect(assign.status()).toBe(200);
    const { data: updated } = await assign.json();
    expect(updated.status).toBe("ASSIGNED");
    expect(updated.technicianId).toBe(techList[0].id);
  });

  test("technician marks ticket resolved", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const techToken = await loginAs(request, "tech@ethiotelecom.et");
    const custEmail = "tkt-resolve@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Resolve Cust", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    // Create and assign
    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Resolve test",
        category: "ROUTER",
        description: "Test resolve",
      },
    });
    const { data: ticket } = await create.json();

    const techs = await request.get(`${BASE}/api/technicians`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: techList } = await techs.json();

    await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { technicianId: techList[0].id },
    });

    // Resolve
    const resolve = await request.post(
      `${BASE}/api/tickets/${ticket.id}/resolve`,
      {
        headers: { Authorization: `Bearer ${techToken}` },
      }
    );
    expect(resolve.status()).toBe(200);
    const { data: resolved } = await resolve.json();
    expect(resolved.status).toBe("RESOLVED");
  });

  test("customer reviews resolved ticket", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const techToken = await loginAs(request, "tech@ethiotelecom.et");
    const custEmail = "tkt-review@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Review Cust", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    // Create, assign, resolve
    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Review test",
        category: "SLOW_SPEED",
        description: "Test review",
      },
    });
    const { data: ticket } = await create.json();

    const techs = await request.get(`${BASE}/api/technicians`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: techList } = await techs.json();

    await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { technicianId: techList[0].id },
    });

    await request.post(`${BASE}/api/tickets/${ticket.id}/resolve`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });

    // Review
    const review = await request.post(`${BASE}/api/tickets/${ticket.id}/review`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: { rating: 5, comment: "Great service!" },
    });
    expect(review.status()).toBe(201);

    // Ticket is now closed
    const check = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
    });
    const { data: checked } = await check.json();
    expect(checked.status).toBe("CLOSED");
  });

  test("only assigned tech can resolve their ticket", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const custEmail = "tkt-unassign@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Unassign Cust", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Unassigned resolve test",
        category: "NO_CONNECTION",
        description: "Test",
      },
    });
    const { data: ticket } = await create.json();

    // Try to resolve without being assigned
    const resolve = await request.post(
      `${BASE}/api/tickets/${ticket.id}/resolve`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    expect(resolve.status()).toBe(403);
  });
});
