import { test, expect } from "@playwright/test";

const BASE = "https://ethio-telecom-rms.vercel.app";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
}

test.describe("Auth", () => {
  test("register new customer", async ({ request }) => {
    const email = uniqueEmail("reg");
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Test User",
        email,
        password: "password123",
        phone: "+251911111111",
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.user.email).toBe(email);
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
  });

  test("login returns tokens", async ({ request }) => {
    const email = uniqueEmail("login");
    // Register first
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Login Test", email, password: "password123" },
    });

    // Then login
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password: "password123" },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
  });

  test("refresh token rotates", async ({ request }) => {
    const email = uniqueEmail("refresh");
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Refresh Test", email, password: "password123" },
    });

    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password: "password123" },
    });
    const { data: loginData } = await login.json();
    const oldRefresh = loginData.refreshToken;

    const refresh = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: oldRefresh },
    });
    expect(refresh.status()).toBe(200);
    const { data: refreshData } = await refresh.json();
    expect(refreshData.refreshToken).not.toBe(oldRefresh);

    // Old token revoked
    const reuse = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: oldRefresh },
    });
    expect(reuse.status()).toBe(401);
  });

  test("get me returns current user", async ({ request }) => {
    const email = uniqueEmail("me");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Me Test", email, password: "password123" },
    });
    const { data } = await reg.json();

    const me = await request.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    expect(me.status()).toBe(200);
    const { data: userData } = await me.json();
    expect(userData.email).toBe(email);
  });

  test("logout revokes token", async ({ request }) => {
    const email = uniqueEmail("logout");
    const reg = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Logout Test", email, password: "password123" },
    });
    const { data: regData } = await reg.json();

    const logout = await request.post(`${BASE}/api/auth/logout`, {
      data: { refreshToken: regData.refreshToken },
    });
    expect(logout.status()).toBe(200);

    // Refresh fails after logout
    const refresh = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: regData.refreshToken },
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

  test("wrong password fails", async ({ request }) => {
    const email = uniqueEmail("wrongpass");
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Wrong Pass", email, password: "password123" },
    });

    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("duplicate email rejected", async ({ request }) => {
    const email = uniqueEmail("dup");
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Dup1", email, password: "password123" },
    });

    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Dup2", email, password: "password123" },
    });
    expect(res.status()).toBe(409);
  });
});
