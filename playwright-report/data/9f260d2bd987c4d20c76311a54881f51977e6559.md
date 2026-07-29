# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.ts >> Security >> refresh token single-use
- Location: tests/security.spec.ts:84:7

# Error details

```
TypeError: Cannot read properties of undefined (reading 'refreshToken')
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const BASE = "https://ethio-telecom-rms.vercel.app";
  4   | 
  5   | async function loginAs(request: any, email: string) {
  6   |   const res = await request.post(`${BASE}/api/auth/login`, {
  7   |     data: { email, password: "password123" },
  8   |   });
  9   |   if (!res.ok) {
  10  |     throw new Error(`Login failed for ${email}: ${res.status()}`);
  11  |   }
  12  |   const json = await res.json();
  13  |   return json.data.accessToken;
  14  | }
  15  | 
  16  | test.describe("Security", () => {
  17  |   test("admin routes blocked for non-admin", async ({ request }) => {
  18  |     const email = "sec-nonadmin@test.example";
  19  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  20  |       data: { name: "Non Admin", email, password: "password123" },
  21  |     });
  22  |     const { data } = await reg.json();
  23  | 
  24  |     const res = await request.get(`${BASE}/api/admin/queue`, {
  25  |       headers: { Authorization: `Bearer ${data.accessToken}` },
  26  |     });
  27  |     expect(res.status()).toBe(403);
  28  |   });
  29  | 
  30  |   test("admin queue shows all tickets", async ({ request }) => {
  31  |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  32  |     const custEmail = "sec-queueall@test.example";
  33  |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  34  |       data: { name: "Queue All", email: custEmail, password: "password123" },
  35  |     });
  36  |     const { data: custData } = await custReg.json();
  37  | 
  38  |     // Create a ticket
  39  |     await request.post(`${BASE}/api/tickets`, {
  40  |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  41  |       data: {
  42  |         subject: "Test ticket",
  43  |         category: "NO_CONNECTION",
  44  |         description: "Test",
  45  |       },
  46  |     });
  47  | 
  48  |     // Admin sees all
  49  |     const queue = await request.get(`${BASE}/api/admin/queue`, {
  50  |       headers: { Authorization: `Bearer ${adminToken}` },
  51  |     });
  52  |     expect(queue.status()).toBe(200);
  53  |     const { data } = await queue.json();
  54  |     expect(data.total).toBeGreaterThanOrEqual(1);
  55  |   });
  56  | 
  57  |   test("technician cannot list customer tickets", async ({ request }) => {
  58  |     const techToken = await loginAs(request, "tech@ethiotelecom.et");
  59  |     const custEmail = "sec-techlist@test.example";
  60  |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  61  |       data: { name: "Tech List", email: custEmail, password: "password123" },
  62  |     });
  63  |     const { data: custData } = await custReg.json();
  64  | 
  65  |     // Customer creates unassigned ticket
  66  |     const create = await request.post(`${BASE}/api/tickets`, {
  67  |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  68  |       data: {
  69  |         subject: "Private ticket",
  70  |         category: "BILLING",
  71  |         description: "Should not see",
  72  |       },
  73  |     });
  74  |     const { data: ticket } = await create.json();
  75  | 
  76  |     // Tech can't see unassigned tickets
  77  |     const list = await request.get(`${BASE}/api/tickets`, {
  78  |       headers: { Authorization: `Bearer ${techToken}` },
  79  |     });
  80  |     const { data: tickets } = await list.json();
  81  |     expect(tickets.some((t: any) => t.id === ticket.id)).toBeFalsy();
  82  |   });
  83  | 
  84  |   test("refresh token single-use", async ({ request }) => {
  85  |     const email = "sec-singleuse@test.example";
  86  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  87  |       data: { name: "Single Use", email, password: "password123" },
  88  |     });
  89  |     const { data: regData } = await reg.json();
  90  | 
  91  |     // Use refresh token
  92  |     const r1 = await request.post(`${BASE}/api/auth/refresh`, {
> 93  |       data: { refreshToken: regData.refreshToken },
      |                                     ^ TypeError: Cannot read properties of undefined (reading 'refreshToken')
  94  |     });
  95  |     expect(r1.status()).toBe(200);
  96  | 
  97  |     // Reuse fails
  98  |     const r2 = await request.post(`${BASE}/api/auth/refresh`, {
  99  |       data: { refreshToken: regData.refreshToken },
  100 |     });
  101 |     expect(r2.status()).toBe(401);
  102 |   });
  103 | 
  104 |   test("invalid JWT rejected", async ({ request }) => {
  105 |     const res = await request.get(`${BASE}/api/auth/me`, {
  106 |       headers: { Authorization: "Bearer invalid.token.here" },
  107 |     });
  108 |     expect(res.status()).toBe(401);
  109 |   });
  110 | 
  111 |   test("ownership blocks access to another customer's ticket", async ({
  112 |     request,
  113 |   }) => {
  114 |     const email1 = "sec-own1@test.example";
  115 |     const email2 = "sec-own2@test.example";
  116 | 
  117 |     const reg1 = await request.post(`${BASE}/api/auth/register`, {
  118 |       data: { name: "Owner1", email: email1, password: "password123" },
  119 |     });
  120 |     const { data: data1 } = await reg1.json();
  121 | 
  122 |     const reg2 = await request.post(`${BASE}/api/auth/register`, {
  123 |       data: { name: "Owner2", email: email2, password: "password123" },
  124 |     });
  125 |     const { data: data2 } = await reg2.json();
  126 | 
  127 |     // Cust1 creates ticket
  128 |     const create = await request.post(`${BASE}/api/tickets`, {
  129 |       headers: { Authorization: `Bearer ${data1.accessToken}` },
  130 |       data: {
  131 |         subject: "Private",
  132 |         category: "NO_CONNECTION",
  133 |         description: "My ticket",
  134 |       },
  135 |     });
  136 |     const { data: ticket } = await create.json();
  137 | 
  138 |     // Cust2 tries to access
  139 |     const access = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
  140 |       headers: { Authorization: `Bearer ${data2.accessToken}` },
  141 |     });
  142 |     expect(access.status()).toBe(403);
  143 | 
  144 |     // Cust2 tries to PATCH
  145 |     const patch = await request.patch(`${BASE}/api/tickets/${ticket.id}`, {
  146 |       headers: { Authorization: `Bearer ${data2.accessToken}` },
  147 |       data: { description: "Hacked" },
  148 |     });
  149 |     expect(patch.status()).toBe(403);
  150 |   });
  151 | 
  152 |   test("customer cannot reassign own ticket", async ({ request }) => {
  153 |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  154 |     const custEmail = "sec-noreassign@test.example";
  155 |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  156 |       data: { name: "No Reassign", email: custEmail, password: "password123" },
  157 |     });
  158 |     const { data: custData } = await custReg.json();
  159 | 
  160 |     const create = await request.post(`${BASE}/api/tickets`, {
  161 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  162 |       data: {
  163 |         subject: "My ticket",
  164 |         category: "ROUTER",
  165 |         description: "Test",
  166 |       },
  167 |     });
  168 |     const { data: ticket } = await create.json();
  169 | 
  170 |     // Get tech ID
  171 |     const techs = await request.get(`${BASE}/api/technicians`, {
  172 |       headers: { Authorization: `Bearer ${adminToken}` },
  173 |     });
  174 |     const { data: techList } = await techs.json();
  175 | 
  176 |     // Customer tries to assign (only admin can)
  177 |     const assign = await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
  178 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  179 |       data: { technicianId: techList[0].id },
  180 |     });
  181 |     expect(assign.status()).toBe(403);
  182 |   });
  183 | 
  184 |   test("technician cannot resolve unassigned ticket", async ({ request }) => {
  185 |     const techToken = await loginAs(request, "tech@ethiotelecom.et");
  186 |     const custEmail = "sec-noresolve@test.example";
  187 |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  188 |       data: { name: "No Resolve", email: custEmail, password: "password123" },
  189 |     });
  190 |     const { data: custData } = await custReg.json();
  191 | 
  192 |     const create = await request.post(`${BASE}/api/tickets`, {
  193 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
```