# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.ts >> Security >> password field not returned in auth responses
- Location: tests/security.spec.ts:224:7

# Error details

```
TypeError: Cannot read properties of undefined (reading 'user')
```

# Test source

```ts
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
  194 |       data: {
  195 |         subject: "Unassigned",
  196 |         category: "NO_CONNECTION",
  197 |         description: "Not for this tech",
  198 |       },
  199 |     });
  200 |     const { data: ticket } = await create.json();
  201 | 
  202 |     // Tech tries to resolve without assignment
  203 |     const resolve = await request.post(
  204 |       `${BASE}/api/tickets/${ticket.id}/resolve`,
  205 |       {
  206 |         headers: { Authorization: `Bearer ${techToken}` },
  207 |       }
  208 |     );
  209 |     expect(resolve.status()).toBe(403);
  210 |   });
  211 | 
  212 |   test("register only creates CUSTOMER role", async ({ request }) => {
  213 |     const register = await request.post(`${BASE}/api/auth/register`, {
  214 |       data: {
  215 |         name: "Role Test",
  216 |         email: "roletest@test.example",
  217 |         password: "password123",
  218 |       },
  219 |     });
  220 |     const { data } = await register.json();
  221 |     expect(data.user.role).toBe("CUSTOMER");
  222 |   });
  223 | 
  224 |   test("password field not returned in auth responses", async ({ request }) => {
  225 |     const register = await request.post(`${BASE}/api/auth/register`, {
  226 |       data: {
  227 |         name: "Hash Check",
  228 |         email: "hashcheck@test.example",
  229 |         password: "password123",
  230 |       },
  231 |     });
  232 |     const { data } = await register.json();
  233 |     // Verify password field is not in the user object returned
> 234 |     expect(data.user).not.toHaveProperty("password");
      |                 ^ TypeError: Cannot read properties of undefined (reading 'user')
  235 |   });
  236 | });
  237 | 
```