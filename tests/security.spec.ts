import { test, expect } from "@playwright/test";

const BASE = "https://ethio-telecom-rms.vercel.app";

async function loginAs(request: any, email: string) {
  const res = await request.post(`${BASE}/api/auth/login`, {
    data: { email, password: "password123" },
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status()}`);
  }
  const json = await res.json();
  return json.data.accessToken;
}

test.describe("Security", () => {
  test("admin routes blocked for non-admin", async ({ request }) => {
    const email = "sec-nonadmin@test.example";
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Non Admin", email, password: "password123" },
    });
    const { data } = await reg.json();

    const res = await request.get(`${BASE}/api/admin/queue`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test("admin queue shows all tickets", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const custEmail = "sec-queueall@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Queue All", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    // Create a ticket
    await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Test ticket",
        category: "NO_CONNECTION",
        description: "Test",
      },
    });

    // Admin sees all
    const queue = await request.get(`${BASE}/api/admin/queue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(queue.status()).toBe(200);
    const { data } = await queue.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  test("technician cannot list customer tickets", async ({ request }) => {
    const techToken = await loginAs(request, "tech@ethiotelecom.et");
    const custEmail = "sec-techlist@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Tech List", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    // Customer creates unassigned ticket
    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Private ticket",
        category: "BILLING",
        description: "Should not see",
      },
    });
    const { data: ticket } = await create.json();

    // Tech can't see unassigned tickets
    const list = await request.get(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });
    const { data: tickets } = await list.json();
    expect(tickets.some((t: any) => t.id === ticket.id)).toBeFalsy();
  });

  test("refresh token single-use", async ({ request }) => {
    const email = "sec-singleuse@test.example";
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Single Use", email, password: "password123" },
    });
    const { data: regData } = await reg.json();

    // Use refresh token
    const r1 = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: regData.refreshToken },
    });
    expect(r1.status()).toBe(200);

    // Reuse fails
    const r2 = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: regData.refreshToken },
    });
    expect(r2.status()).toBe(401);
  });

  test("invalid JWT rejected", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(res.status()).toBe(401);
  });

  test("ownership blocks access to another customer's ticket", async ({
    request,
  }) => {
    const email1 = "sec-own1@test.example";
    const email2 = "sec-own2@test.example";

    const reg1 = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Owner1", email: email1, password: "password123" },
    });
    const { data: data1 } = await reg1.json();

    const reg2 = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Owner2", email: email2, password: "password123" },
    });
    const { data: data2 } = await reg2.json();

    // Cust1 creates ticket
    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${data1.accessToken}` },
      data: {
        subject: "Private",
        category: "NO_CONNECTION",
        description: "My ticket",
      },
    });
    const { data: ticket } = await create.json();

    // Cust2 tries to access
    const access = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
      headers: { Authorization: `Bearer ${data2.accessToken}` },
    });
    expect(access.status()).toBe(403);

    // Cust2 tries to PATCH
    const patch = await request.patch(`${BASE}/api/tickets/${ticket.id}`, {
      headers: { Authorization: `Bearer ${data2.accessToken}` },
      data: { description: "Hacked" },
    });
    expect(patch.status()).toBe(403);
  });

  test("customer cannot reassign own ticket", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const custEmail = "sec-noreassign@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "No Reassign", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "My ticket",
        category: "ROUTER",
        description: "Test",
      },
    });
    const { data: ticket } = await create.json();

    // Get tech ID
    const techs = await request.get(`${BASE}/api/technicians`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: techList } = await techs.json();

    // Customer tries to assign (only admin can)
    const assign = await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: { technicianId: techList[0].id },
    });
    expect(assign.status()).toBe(403);
  });

  test("technician cannot resolve unassigned ticket", async ({ request }) => {
    const techToken = await loginAs(request, "tech@ethiotelecom.et");
    const custEmail = "sec-noresolve@test.example";
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "No Resolve", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();

    const create = await request.post(`${BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        subject: "Unassigned",
        category: "NO_CONNECTION",
        description: "Not for this tech",
      },
    });
    const { data: ticket } = await create.json();

    // Tech tries to resolve without assignment
    const resolve = await request.post(
      `${BASE}/api/tickets/${ticket.id}/resolve`,
      {
        headers: { Authorization: `Bearer ${techToken}` },
      }
    );
    expect(resolve.status()).toBe(403);
  });

  test("register only creates CUSTOMER role", async ({ request }) => {
    const register = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Role Test",
        email: "roletest@test.example",
        password: "password123",
      },
    });
    const { data } = await register.json();
    expect(data.user.role).toBe("CUSTOMER");
  });

  test("password field not returned in auth responses", async ({ request }) => {
    const register = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Hash Check",
        email: "hashcheck@test.example",
        password: "password123",
      },
    });
    const { data } = await register.json();
    // Verify password field is not in the user object returned
    expect(data.user).not.toHaveProperty("password");
  });
});
