const BASE = "https://ethio-telecom-rms.vercel.app";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.example`;
}

/** Register and return auth token for a new test user */
export async function createTestUser(request: any, email?: string) {
  const testEmail = email || uniqueEmail("testuser");
  const res = await request.post(`${BASE}/api/auth/register`, {
    data: {
      name: "Test User",
      email: testEmail,
      password: "password123",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to register: ${res.status()} ${await res.text()}`);
  }
  const { data } = await res.json();
  return { email: testEmail, token: data.accessToken, refreshToken: data.refreshToken };
}

/** Login an existing seeded user (customer/admin/tech) */
export async function loginSeeded(request: any, email: string, password = "password123") {
  const res = await request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok) {
    // User doesn't exist, create them
    return createTestUser(request, email);
  }
  const { data } = await res.json();
  return { email, token: data.accessToken, refreshToken: data.refreshToken };
}

export { BASE, uniqueEmail };
