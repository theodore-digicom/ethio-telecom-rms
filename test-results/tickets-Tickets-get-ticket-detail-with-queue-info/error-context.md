# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tickets.spec.ts >> Tickets >> get ticket detail with queue info
- Location: tests/tickets.spec.ts:121:7

# Error details

```
TypeError: Cannot read properties of undefined (reading 'accessToken')
```

# Test source

```ts
  29  |     const res = await request.post(`${BASE}/api/tickets`, {
  30  |       headers: { Authorization: `Bearer ${token}` },
  31  |       data: {
  32  |         subject: "No internet since morning",
  33  |         serviceNumber: "0911-ETC-8842",
  34  |         category: "NO_CONNECTION",
  35  |         description: "Line dead, no connectivity",
  36  |         priority: "HIGH",
  37  |       },
  38  |     });
  39  |     expect(res.status()).toBe(201);
  40  |     const { data } = await res.json();
  41  |     expect(data.subject).toBe("No internet since morning");
  42  |     expect(data.serviceNumber).toBe("0911-ETC-8842");
  43  |     expect(data.status).toBe("OPEN");
  44  |     expect(data.ticketNumber).toMatch(/^ETC-\d{8}-\d{4}$/);
  45  |   });
  46  | 
  47  |   test("customer sees only own tickets", async ({ request }) => {
  48  |     const email = "tkt-owner@test.example";
  49  |     const reg = await request.post(`${BASE}/api/auth/register`, {
  50  |       data: { name: "Ticket Owner", email, password: "password123" },
  51  |     });
  52  |     const { data: regData } = await reg.json();
  53  |     const token = regData.accessToken;
  54  | 
  55  |     // Create a ticket
  56  |     await request.post(`${BASE}/api/tickets`, {
  57  |       headers: { Authorization: `Bearer ${token}` },
  58  |       data: {
  59  |         subject: "My ticket",
  60  |         category: "SLOW_SPEED",
  61  |         description: "Test",
  62  |       },
  63  |     });
  64  | 
  65  |     const res = await request.get(`${BASE}/api/tickets`, {
  66  |       headers: { Authorization: `Bearer ${token}` },
  67  |     });
  68  |     expect(res.status()).toBe(200);
  69  |     const { data: tickets } = await res.json();
  70  |     // All returned tickets should belong to this customer
  71  |     tickets.forEach((t: any) => {
  72  |       expect(t.customerId).toBe(regData.user.id);
  73  |     });
  74  |   });
  75  | 
  76  |   test("technician sees only assigned tickets", async ({ request }) => {
  77  |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  78  |     const techEmail = "tech-viewer@test.example";
  79  |     const techReg = await request.post(`${BASE}/api/auth/register`, {
  80  |       data: { name: "Tech Viewer", email: techEmail, password: "password123" },
  81  |     });
  82  | 
  83  |     const custEmail = "cust-for-tech@test.example";
  84  |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  85  |       data: { name: "Cust For Tech", email: custEmail, password: "password123" },
  86  |     });
  87  |     const { data: custData } = await custReg.json();
  88  | 
  89  |     // Create a ticket
  90  |     const ticketRes = await request.post(`${BASE}/api/tickets`, {
  91  |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  92  |       data: {
  93  |         subject: "Router issue",
  94  |         category: "ROUTER",
  95  |         description: "Test",
  96  |       },
  97  |     });
  98  |     const { data: ticket } = await ticketRes.json();
  99  | 
  100 |     // Assign to technician (need real tech ID from seed)
  101 |     const techs = await request.get(`${BASE}/api/technicians`, {
  102 |       headers: { Authorization: `Bearer ${adminToken}` },
  103 |     });
  104 |     const { data: techList } = await techs.json();
  105 |     const techId = techList[0].id;
  106 | 
  107 |     await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
  108 |       headers: { Authorization: `Bearer ${adminToken}` },
  109 |       data: { technicianId: techId },
  110 |     });
  111 | 
  112 |     // Tech sees the ticket
  113 |     const techToken = await loginAs(request, "tech@ethiotelecom.et");
  114 |     const ticketsList = await request.get(`${BASE}/api/tickets`, {
  115 |       headers: { Authorization: `Bearer ${techToken}` },
  116 |     });
  117 |     const { data: ticketsForTech } = await ticketsList.json();
  118 |     expect(ticketsForTech.some((t: any) => t.id === ticket.id)).toBeTruthy();
  119 |   });
  120 | 
  121 |   test("get ticket detail with queue info", async ({ request }) => {
  122 |     const email = "tkt-queue@test.example";
  123 |     const reg = await request.post(`${BASE}/api/auth/register`, {
  124 |       data: { name: "Queue Test", email, password: "password123" },
  125 |     });
  126 |     const { data: regData } = await reg.json();
  127 | 
  128 |     const create = await request.post(`${BASE}/api/tickets`, {
> 129 |       headers: { Authorization: `Bearer ${regData.accessToken}` },
      |                                                   ^ TypeError: Cannot read properties of undefined (reading 'accessToken')
  130 |       data: {
  131 |         subject: "Test queue",
  132 |         category: "SLOW_SPEED",
  133 |         description: "Testing queue position",
  134 |       },
  135 |     });
  136 |     const { data: ticket } = await create.json();
  137 | 
  138 |     const detail = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
  139 |       headers: { Authorization: `Bearer ${regData.accessToken}` },
  140 |     });
  141 |     expect(detail.status()).toBe(200);
  142 |     const { data } = await detail.json();
  143 |     expect(data.queue).toBeDefined();
  144 |     expect(data.queue.position).toBeGreaterThan(0);
  145 |     expect(data.queue.ahead).toBeDefined();
  146 |     expect(data.queue.estimatedWaitMinutes).toBeGreaterThanOrEqual(0);
  147 |   });
  148 | 
  149 |   test("customer cannot view another's ticket", async ({ request }) => {
  150 |     const email1 = "tkt-priv1@test.example";
  151 |     const email2 = "tkt-priv2@test.example";
  152 | 
  153 |     const reg1 = await request.post(`${BASE}/api/auth/register`, {
  154 |       data: { name: "Cust1", email: email1, password: "password123" },
  155 |     });
  156 |     const { data: data1 } = await reg1.json();
  157 | 
  158 |     const reg2 = await request.post(`${BASE}/api/auth/register`, {
  159 |       data: { name: "Cust2", email: email2, password: "password123" },
  160 |     });
  161 |     const { data: data2 } = await reg2.json();
  162 | 
  163 |     // Cust1 creates ticket
  164 |     const create = await request.post(`${BASE}/api/tickets`, {
  165 |       headers: { Authorization: `Bearer ${data1.accessToken}` },
  166 |       data: {
  167 |         subject: "Private ticket",
  168 |         category: "BILLING",
  169 |         description: "My private issue",
  170 |       },
  171 |     });
  172 |     const { data: ticket } = await create.json();
  173 | 
  174 |     // Cust2 tries to access
  175 |     const access = await request.get(`${BASE}/api/tickets/${ticket.id}`, {
  176 |       headers: { Authorization: `Bearer ${data2.accessToken}` },
  177 |     });
  178 |     expect(access.status()).toBe(403);
  179 |   });
  180 | 
  181 |   test("admin assigns ticket to technician", async ({ request }) => {
  182 |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  183 |     const custEmail = "tkt-assign@test.example";
  184 |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  185 |       data: { name: "Assign Cust", email: custEmail, password: "password123" },
  186 |     });
  187 |     const { data: custData } = await custReg.json();
  188 | 
  189 |     const create = await request.post(`${BASE}/api/tickets`, {
  190 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  191 |       data: {
  192 |         subject: "Assign test",
  193 |         category: "NO_CONNECTION",
  194 |         description: "Testing assignment",
  195 |       },
  196 |     });
  197 |     const { data: ticket } = await create.json();
  198 | 
  199 |     const techs = await request.get(`${BASE}/api/technicians`, {
  200 |       headers: { Authorization: `Bearer ${adminToken}` },
  201 |     });
  202 |     const { data: techList } = await techs.json();
  203 | 
  204 |     const assign = await request.post(`${BASE}/api/tickets/${ticket.id}/assign`, {
  205 |       headers: { Authorization: `Bearer ${adminToken}` },
  206 |       data: { technicianId: techList[0].id },
  207 |     });
  208 |     expect(assign.status()).toBe(200);
  209 |     const { data: updated } = await assign.json();
  210 |     expect(updated.status).toBe("ASSIGNED");
  211 |     expect(updated.technicianId).toBe(techList[0].id);
  212 |   });
  213 | 
  214 |   test("technician marks ticket resolved", async ({ request }) => {
  215 |     const adminToken = await loginAs(request, "admin@ethiotelecom.et");
  216 |     const techToken = await loginAs(request, "tech@ethiotelecom.et");
  217 |     const custEmail = "tkt-resolve@test.example";
  218 |     const custReg = await request.post(`${BASE}/api/auth/register`, {
  219 |       data: { name: "Resolve Cust", email: custEmail, password: "password123" },
  220 |     });
  221 |     const { data: custData } = await custReg.json();
  222 | 
  223 |     // Create and assign
  224 |     const create = await request.post(`${BASE}/api/tickets`, {
  225 |       headers: { Authorization: `Bearer ${custData.accessToken}` },
  226 |       data: {
  227 |         subject: "Resolve test",
  228 |         category: "ROUTER",
  229 |         description: "Test resolve",
```