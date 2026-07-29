import { test, expect } from "@playwright/test";

const BASE = "https://ethio-telecom-rms.vercel.app";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
}

test.describe("Auth", () => {
  test("register new customer", async ({ request }) => {
    const email = uniqueEmail("register");
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "John Doe",
        email,
        password: "password123",
        phone: "+251911000000",
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.user.email).toBe(email);
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
  });

  test("login returns tokens", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "customer@example.com",
        password: "password123",
      },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
  });

  test("refresh token rotates", async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "customer@example.com", password: "password123" },
    });
    const { data: loginData } = await login.json();
    const oldRefresh = loginData.refreshToken;

    const refresh = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: oldRefresh },
    });
    expect(refresh.status()).toBe(200);
    const { data: refreshData } = await refresh.json();
    expect(refreshData.refreshToken).not.toBe(oldRefresh);

    const reuse = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: oldRefresh },
    });
    expect(reuse.status()).toBe(401);
  });

  test("get me returns current user", async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "admin@ethiotelecom.et", password: "password123" },
    });
    const { data } = await login.json();

    const me = await request.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    expect(me.status()).toBe(200);
    const { data: userData } = await me.json();
    expect(userData.email).toBe("admin@ethiotelecom.et");
  });

  test("logout revokes token", async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "admin@ethiotelecom.et", password: "password123" },
    });
    const { data: loginData } = await login.json();

    const logout = await request.post(`${BASE}/api/auth/logout`, {
      data: { refreshToken: loginData.refreshToken },
    });
    expect(logout.status()).toBe(200);

    const refresh = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: loginData.refreshToken },
    });
    expect(refresh.status()).toBe(401);
  });

  test("missing auth header blocks protected routes", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("bad token blocks access", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: "Bearer badtoken123" },
    });
    expect(res.status()).toBe(401);
  });
});
