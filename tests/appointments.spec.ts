import { test, expect } from "@playwright/test";

const BASE = "https://ethio-telecom-rms.vercel.app";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
}

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

test.describe("Appointments", () => {
  test("customer reserves branch appointment", async ({ request }) => {
    const email = uniqueEmail("appt-reserve");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Appt Reserver", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        branch: "Addis Ababa Main",
        slotTime: future,
        notes: "Prefer afternoon",
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.branch).toBe("Addis Ababa Main");
    expect(data.status).toBe("RESERVED");
  });

  test("cannot reserve past slot", async ({ request }) => {
    const email = uniqueEmail("appt-past");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Appt Past", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const past = new Date(Date.now() - 1000).toISOString();

    const res = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        branch: "Addis Ababa Main",
        slotTime: past,
      },
    });
    expect(res.status()).toBe(422);
  });

  test("customer cancels own appointment", async ({ request }) => {
    const email = uniqueEmail("appt-cancel");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Appt Canceller", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const create = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        branch: "Addis Ababa Main",
        slotTime: future,
      },
    });
    const { data: appt } = await create.json();

    const cancel = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: { status: "CANCELLED" },
    });
    expect(cancel.status()).toBe(200);
    const { data: cancelled } = await cancel.json();
    expect(cancelled.status).toBe("CANCELLED");
  });

  test("customer cannot complete appointment (staff only)", async ({
    request,
  }) => {
    const email = uniqueEmail("appt-nocomplete");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Appt No Complete", email, password: "password123" },
    });
    const { data: regData } = await reg.json();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const create = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        branch: "Addis Ababa Main",
        slotTime: future,
      },
    });
    const { data: appt } = await create.json();

    const complete = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: { status: "COMPLETED" },
    });
    expect(complete.status()).toBe(403);
  });

  test("admin marks appointment completed", async ({ request }) => {
    const adminToken = await loginAs(request, "admin@ethiotelecom.et");
    const custEmail = uniqueEmail("appt-admincomplete");
    const custReg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Appt Admin", email: custEmail, password: "password123" },
    });
    const { data: custData } = await custReg.json();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const create = await request.post(`${BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${custData.accessToken}` },
      data: {
        branch: "Addis Ababa Main",
        slotTime: future,
      },
    });
    const { data: appt } = await create.json();

    const complete = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "COMPLETED" },
    });
    expect(complete.status()).toBe(200);
    const { data: completed } = await complete.json();
    expect(completed.status).toBe("COMPLETED");
  });
});
