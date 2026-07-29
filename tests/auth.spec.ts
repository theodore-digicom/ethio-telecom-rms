import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3055";

test.describe("Auth", () => {
  // Generate unique test email per test to avoid conflicts
  function uniqueEmail(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
  }

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
    expect(data.user.email).toBe("uniqueEmail("register")
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
  });

  test("register with duplicate email fails", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Jane",
        email: "customer@example.com",
        password: "pass123",
      },
    });
    expect(res.status()).toBe(409);
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

  test("login with wrong password fails", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: "customer@example.com",
        password: "wrongpass",
      },
    });
    expect(res.status()).toBe(401);
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
    expect(refreshData.refreshToken).toBeTruthy();
    expect(refreshData.refreshToken).not.toBe(oldRefresh);

    // Old token is revoked
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
    expect(userData.role).toBe("ADMIN");
  });

  test("change password revokes sessions", async ({ request }) => {
    // Use a unique email to avoid state conflicts
    const testEmail = "changepass@test.example";
    const register = await request.post(`${BASE}/api/auth/register`, {
      data: {
        name: "Change Test",
        email: testEmail,
        password: "password123",
      },
    });
    const { data: regData } = await register.json();
    const refresh1 = regData.refreshToken;

    // Change password
    const change = await request.post(`${BASE}/api/auth/change-password`, {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
      data: {
        currentPassword: "password123",
        newPassword: "newpass456",
      },
    });
    expect(change.status()).toBe(200);

    // Old refresh token revoked
    const reuse = await request.post(`${BASE}/api/auth/refresh`, {
      data: { refreshToken: refresh1 },
    });
    expect(reuse.status()).toBe(401);

    // New password works
    const newLogin = await request.post(`${BASE}/api/auth/login`, {
      data: { email: testEmail, password: "newpass456" },
    });
    expect(newLogin.status()).toBe(200);
  });

  test("forgot-password initiates reset flow", async ({ request }) => {
    const testEmail = "reset@test.example";
    // Register a user first
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Reset Test", email: testEmail, password: "password123" },
    });

    const forgot = await request.post(`${BASE}/api/auth/forgot-password`, {
      data: { email: testEmail },
    });
    expect(forgot.status()).toBe(200);
    const { data: forgotData } = await forgot.json();
    expect(forgotData.message).toContain("reset link has been sent");
    // devResetToken only returned if email send fails (in dev when no key)
    if (forgotData.devResetToken) {
      expect(forgotData.devResetToken).toBeTruthy();
    }
  });

  test("reset-password with valid token", async ({ request }) => {
    const testEmail = "resetvalid@test.example";
    // Register
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Reset Valid", email: testEmail, password: "password123" },
    });

    // Forgot password
    const forgot = await request.post(`${BASE}/api/auth/forgot-password`, {
      data: { email: testEmail },
    });
    const { data: forgotData } = await forgot.json();

    // If devResetToken is present, use it; otherwise skip this test
    if (!forgotData.devResetToken) {
      test.skip();
      return;
    }

    const reset = await request.post(`${BASE}/api/auth/reset-password`, {
      data: { token: forgotData.devResetToken, newPassword: "resetpass789" },
    });
    expect(reset.status()).toBe(200);

    // New password works
    const newLogin = await request.post(`${BASE}/api/auth/login`, {
      data: { email: testEmail, password: "resetpass789" },
    });
    expect(newLogin.status()).toBe(200);
  });

  test("logout revokes refresh token", async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "admin@ethiotelecom.et", password: "password123" },
    });
    const { data: loginData } = await login.json();

    const logout = await request.post(`${BASE}/api/auth/logout`, {
      data: { refreshToken: loginData.refreshToken },
    });
    expect(logout.status()).toBe(200);

    // Refresh fails after logout
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

  test("PATCH profile updates fields", async ({ request }) => {
    const testEmail = "profileupdate@test.example";
    const register = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Profile Test", email: testEmail, password: "password123" },
    });
    const { data } = await register.json();

    const patch = await request.patch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
      data: { phone: "+251922222222", name: "Profile Updated" },
    });
    expect(patch.status()).toBe(200);
    const { data: userData } = await patch.json();
    expect(userData.phone).toBe("+251922222222");
    expect(userData.name).toBe("Profile Updated");
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
});
