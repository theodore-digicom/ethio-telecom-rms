# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: appointments.spec.ts >> Appointments >> cannot reserve past slot
- Location: tests/appointments.spec.ts:39:7

# Error details

```
TypeError: Cannot read properties of undefined (reading 'accessToken')
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
  16  | test.describe("Appointments", () => {
  17  |   test("customer reserves branch appointment", async ({ request }) => {
  18  |     const email = "appt-reserve@test.example";
  19  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  20  |       data: { name: "Appt Reserver", email, password: "password123" },
  21  |     });
  22  |     const { data: regData } = await reg.json();
  23  |     const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  24  | 
  25  |     const res = await request.post(`${BASE}/api/appointments`, {
  26  |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  27  |       data: {
  28  |         branch: "Addis Ababa Main",
  29  |         slotTime: future,
  30  |         notes: "Prefer afternoon",
  31  |       },
  32  |     });
  33  |     expect(res.status()).toBe(201);
  34  |     const { data } = await res.json();
  35  |     expect(data.branch).toBe("Addis Ababa Main");
  36  |     expect(data.status).toBe("RESERVED");
  37  |   });
  38  | 
  39  |   test("cannot reserve past slot", async ({ request }) => {
  40  |     const email = "appt-past@test.example";
  41  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  42  |       data: { name: "Appt Past", email, password: "password123" },
  43  |     });
  44  |     const { data: regData } = await reg.json();
  45  |     const past = new Date(Date.now() - 1000).toISOString();
  46  | 
  47  |     const res = await request.post(`${BASE}/api/appointments`, {
> 48  |       headers: { Authorization: `Bearer ${regData.accessToken}` },
      |                                                   ^ TypeError: Cannot read properties of undefined (reading 'accessToken')
  49  |       data: {
  50  |         branch: "Addis Ababa Main",
  51  |         slotTime: past,
  52  |       },
  53  |     });
  54  |     expect(res.status()).toBe(422);
  55  |   });
  56  | 
  57  |   test("customer cancels own appointment", async ({ request }) => {
  58  |     const email = "appt-cancel@test.example";
  59  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  60  |       data: { name: "Appt Canceller", email, password: "password123" },
  61  |     });
  62  |     const { data: regData } = await reg.json();
  63  |     const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  64  | 
  65  |     const create = await request.post(`${BASE}/api/appointments`, {
  66  |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  67  |       data: {
  68  |         branch: "Addis Ababa Main",
  69  |         slotTime: future,
  70  |       },
  71  |     });
  72  |     const { data: appt } = await create.json();
  73  | 
  74  |     const cancel = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
  75  |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  76  |       data: { status: "CANCELLED" },
  77  |     });
  78  |     expect(cancel.status()).toBe(200);
  79  |     const { data: cancelled } = await cancel.json();
  80  |     expect(cancelled.status).toBe("CANCELLED");
  81  |   });
  82  | 
  83  |   test("customer cannot complete appointment (staff only)", async ({
  84  |     request,
  85  |   }) => {
  86  |     const email = "appt-nocomplete@test.example";
  87  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  88  |       data: { name: "Appt No Complete", email, password: "password123" },
  89  |     });
  90  |     const { data: regData } = await reg.json();
  91  |     const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  92  | 
  93  |     const create = await request.post(`${BASE}/api/appointments`, {
  94  |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  95  |       data: {
  96  |         branch: "Addis Ababa Main",
  97  |         slotTime: future,
  98  |       },
  99  |     });
  100 |     const { data: appt } = await create.json();
  101 | 
  102 |     const complete = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
  103 |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  104 |       data: { status: "COMPLETED" },
  105 |     });
  106 |     expect(complete.status()).toBe(403);
  107 |   });
  108 | 
  109 |   test("admin marks appointment completed", async ({ request }) => {
  110 |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  111 |     const custEmail = "appt-admincomplete@test.example";
  112 |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  113 |       data: { name: "Appt Admin", email: custEmail, password: "password123" },
  114 |     });
  115 |     const { data: custData } = await custReg.json();
  116 |     const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  117 | 
  118 |     const create = await request.post(`${BASE}/api/appointments`, {
  119 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  120 |       data: {
  121 |         branch: "Addis Ababa Main",
  122 |         slotTime: future,
  123 |       },
  124 |     });
  125 |     const { data: appt } = await create.json();
  126 | 
  127 |     const complete = await request.patch(`${BASE}/api/appointments/${appt.id}`, {
  128 |       headers: { Authorization: `Bearer ${adminToken}` },
  129 |       data: { status: "COMPLETED" },
  130 |     });
  131 |     expect(complete.status()).toBe(200);
  132 |     const { data: completed } = await complete.json();
  133 |     expect(completed.status).toBe("COMPLETED");
  134 |   });
  135 | });
  136 | 
```