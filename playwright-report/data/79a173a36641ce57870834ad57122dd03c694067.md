# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth >> wrong password fails
- Location: tests/auth.spec.ts:116:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 500
```

# Test source

```ts
  25  |   });
  26  | 
  27  |   test("login returns tokens", async ({ request }) => {
  28  |     const email = uniqueEmail("login");
  29  |     // Register first
  30  |     await request.post(`${BASE}/api/auth/register`, {
  31  |       data: { name: "Login Test", email, password: "password123" },
  32  |     });
  33  | 
  34  |     // Then login
  35  |     const res = await request.post(`${BASE}/api/auth/login`, {
  36  |       data: { email, password: "password123" },
  37  |     });
  38  |     expect(res.status()).toBe(200);
  39  |     const { data } = await res.json();
  40  |     expect(data.accessToken).toBeTruthy();
  41  |     expect(data.refreshToken).toBeTruthy();
  42  |   });
  43  | 
  44  |   test("refresh token rotates", async ({ request }) => {
  45  |     const email = uniqueEmail("refresh");
  46  |     await request.post(`${BASE}/api/auth/register`, {
  47  |       data: { name: "Refresh Test", email, password: "password123" },
  48  |     });
  49  | 
  50  |     const login = await request.post(`${BASE}/api/auth/login`, {
  51  |       data: { email, password: "password123" },
  52  |     });
  53  |     const { data: loginData } = await login.json();
  54  |     const oldRefresh = loginData.refreshToken;
  55  | 
  56  |     const refresh = await request.post(`${BASE}/api/auth/refresh`, {
  57  |       data: { refreshToken: oldRefresh },
  58  |     });
  59  |     expect(refresh.status()).toBe(200);
  60  |     const { data: refreshData } = await refresh.json();
  61  |     expect(refreshData.refreshToken).not.toBe(oldRefresh);
  62  | 
  63  |     // Old token revoked
  64  |     const reuse = await request.post(`${BASE}/api/auth/refresh`, {
  65  |       data: { refreshToken: oldRefresh },
  66  |     });
  67  |     expect(reuse.status()).toBe(401);
  68  |   });
  69  | 
  70  |   test("get me returns current user", async ({ request }) => {
  71  |     const email = uniqueEmail("me");
  72  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  73  |       data: { name: "Me Test", email, password: "password123" },
  74  |     });
  75  |     const { data } = await reg.json();
  76  | 
  77  |     const me = await request.get(`${BASE}/api/auth/me`, {
  78  |       headers: { Authorization: `Bearer ${data.accessToken}` },
  79  |     });
  80  |     expect(me.status()).toBe(200);
  81  |     const { data: userData } = await me.json();
  82  |     expect(userData.email).toBe(email);
  83  |   });
  84  | 
  85  |   test("logout revokes token", async ({ request }) => {
  86  |     const email = uniqueEmail("logout");
  87  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  88  |       data: { name: "Logout Test", email, password: "password123" },
  89  |     });
  90  |     const { data: regData } = await reg.json();
  91  | 
  92  |     const logout = await request.post(`${BASE}/api/auth/logout`, {
  93  |       data: { refreshToken: regData.refreshToken },
  94  |     });
  95  |     expect(logout.status()).toBe(200);
  96  | 
  97  |     // Refresh fails after logout
  98  |     const refresh = await request.post(`${BASE}/api/auth/refresh`, {
  99  |       data: { refreshToken: regData.refreshToken },
  100 |     });
  101 |     expect(refresh.status()).toBe(401);
  102 |   });
  103 | 
  104 |   test("missing auth header blocks protected routes", async ({ request }) => {
  105 |     const res = await request.get(`${BASE}/api/auth/me`);
  106 |     expect(res.status()).toBe(401);
  107 |   });
  108 | 
  109 |   test("bad token blocks access", async ({ request }) => {
  110 |     const res = await request.get(`${BASE}/api/auth/me`, {
  111 |       headers: { Authorization: "Bearer badtoken123" },
  112 |     });
  113 |     expect(res.status()).toBe(401);
  114 |   });
  115 | 
  116 |   test("wrong password fails", async ({ request }) => {
  117 |     const email = uniqueEmail("wrongpass");
  118 |     await request.post(`${BASE}/api/auth/register`, {
  119 |       data: { name: "Wrong Pass", email, password: "password123" },
  120 |     });
  121 | 
  122 |     const res = await request.post(`${BASE}/api/auth/login`, {
  123 |       data: { email, password: "wrongpassword" },
  124 |     });
> 125 |     expect(res.status()).toBe(401);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  126 |   });
  127 | 
  128 |   test("duplicate email rejected", async ({ request }) => {
  129 |     const email = uniqueEmail("dup");
  130 |     await request.post(`${BASE}/api/auth/register`, {
  131 |       data: { name: "Dup1", email, password: "password123" },
  132 |     });
  133 | 
  134 |     const res = await request.post(`${BASE}/api/auth/register`, {
  135 |       data: { name: "Dup2", email, password: "password123" },
  136 |     });
  137 |     expect(res.status()).toBe(409);
  138 |   });
  139 | });
  140 | 
```