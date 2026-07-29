import { test, expect } from "@playwright/test";

const BASE = "https://ethio-telecom-rms.vercel.app";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
}

async function getAdminToken(request: any) {
  // Create or login as admin
  const adminEmail = "admin-test-" + Date.now() + "@ethiotelecom.et";
  const res = await request.post(`${BASE}/api/auth/register`, {
    data: {
      name: "Admin Test",
      email: adminEmail,
      password: "password123",
    },
  });
  const { data } = await res.json();

  // Manually promote to admin via direct DB would be needed in real scenario
  // For test, assume we have a seeded admin already
  // OR create a test user and we'll skip this for now
  return data.accessToken;
}

test.describe("Admin User Management", () => {
  test("admin can invite technician", async ({ request }) => {
    // Login as admin (using seeded account if available, or skip)
    const adminRes = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "admin@ethiotelecom.et",
        password: "password123",
      },
    });

    if (adminRes.status() !== 200) {
      test.skip();
    }

    const { data: adminData } = await adminRes.json();
    const adminToken = adminData.accessToken;

    // Invite new technician
    const techEmail = uniqueEmail("invite-tech");
    const res = await request.post(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: techEmail,
        name: "Invited Technician",
        role: "TECHNICIAN",
      },
    });

    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.user.email).toBe(techEmail);
    expect(data.user.role).toBe("TECHNICIAN");
    expect(data.message).toContain("Invitation sent");
  });

  test("admin can invite another admin", async ({ request }) => {
    const adminRes = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "admin@ethiotelecom.et",
        password: "password123",
      },
    });

    if (adminRes.status() !== 200) {
      test.skip();
    }

    const { data: adminData } = await adminRes.json();
    const adminToken = adminData.accessToken;

    const newAdminEmail = uniqueEmail("invite-admin");
    const res = await request.post(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: newAdminEmail,
        name: "New Admin",
        role: "ADMIN",
      },
    });

    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.user.role).toBe("ADMIN");
  });

  test("non-admin cannot invite users", async ({ request }) => {
    // Register as customer
    const custEmail = uniqueEmail("customer");
    const custRes = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Customer",
        email: custEmail,
        password: "password123",
      },
    });
    const { data: custData } = await custRes.json();

    // Try to invite (should fail)
    const res = await request.post(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        email: uniqueEmail("another"),
        name: "Trying to invite",
        role: "TECHNICIAN",
      },
    });

    expect(res.status()).toBe(403); // Forbidden
  });

  test("duplicate email rejected on invite", async ({ request }) => {
    const adminRes = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "admin@ethiotelecom.et",
        password: "password123",
      },
    });

    if (adminRes.status() !== 200) {
      test.skip();
    }

    const { data: adminData } = await adminRes.json();
    const adminToken = adminData.accessToken;

    const email = uniqueEmail("dup");

    // First invite
    await request.post(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { email, name: "User 1", role: "TECHNICIAN" },
    });

    // Second invite with same email
    const res = await request.post(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { email, name: "User 2", role: "ADMIN" },
    });

    expect(res.status()).toBe(409); // Conflict
  });

  test("admin can list all users", async ({ request }) => {
    const adminRes = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "admin@ethiotelecom.et",
        password: "password123",
      },
    });

    if (adminRes.status() !== 200) {
      test.skip();
    }

    const { data: adminData } = await adminRes.json();
    const adminToken = adminData.accessToken;

    const res = await request.get(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users[0]).toHaveProperty("email");
    expect(data.users[0]).toHaveProperty("role");
    expect(data.users[0]).not.toHaveProperty("password");
  });
});
