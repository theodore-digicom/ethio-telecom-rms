# Ethio Telecom — Report Management System (API)

Next.js (App Router) API-only backend for reporting internet faults, tracking ticket
status in a live queue, reserving branch appointments, and reviewing service.

## Stack

- Next.js 15 (App Router, Route Handlers) — API only
- TypeScript
- Prisma + SQLite (zero external setup for dev)
- JWT auth (`jose`) + bcrypt password hashing
- Zod request validation

## Setup

```bash
npm install
npm run db:push      # create SQLite schema
npm run db:seed      # seed admin / technician / customer (password: password123)
npm run dev          # http://localhost:3000
```

Seeded accounts:

| Role       | Email                      | Password    |
|------------|----------------------------|-------------|
| Admin      | admin@ethiotelecom.et      | password123 |
| Technician | tech@ethiotelecom.et       | password123 |
| Customer   | customer@example.com       | password123 |

## Auth

Access + refresh token flow:

- `login` / `register` return `{ accessToken, refreshToken, user }`.
- Send the **access token** on protected routes: `Authorization: Bearer <accessToken>` (expires in 15m).
- When the access token expires, `POST /api/auth/refresh` with `{ "refreshToken": "..." }` to get a new pair.
- Refresh tokens are **rotated** on every use (old one revoked) and stored only as a sha256 hash.
- `POST /api/auth/logout` with `{ refreshToken }` revokes one token; `{ allDevices: true }` (+ Bearer access token) revokes all of the user's sessions.
- Refresh lifetime: `REFRESH_TTL_DAYS` (default 30).

## Endpoints

`GET /` returns the full endpoint index. Highlights:

### Auth
- `POST /api/auth/register` — customer self-registration (returns token pair)
- `POST /api/auth/login` — returns access + refresh token
- `POST /api/auth/refresh` — rotate refresh token, get new pair
- `POST /api/auth/logout` — revoke refresh token(s)
- `POST /api/auth/forgot-password` — request reset token (dev returns `devResetToken`)
- `POST /api/auth/reset-password` — set new password with token (single-use, logs out everywhere)
- `POST /api/auth/change-password` — change password while logged in
- `GET /api/auth/me` — current user
- `PATCH /api/auth/me` — update profile (name/phone/email)
- `DELETE /api/auth/me` — delete own account (blocked while tickets exist)

### Tickets
- `POST /api/tickets` — report a problem, receive a digital ticket
- `GET /api/tickets` — list (customers: own, technicians: assigned, admin: all; `?status=`)
- `GET /api/tickets/:id` — detail + live queue position/ETA
- `GET /api/tickets/:id/queue` — queue position, people ahead, estimated wait
- `PATCH /api/tickets/:id` — customer cancels; staff change status/priority
- `POST /api/tickets/:id/assign` — admin assigns a technician
- `POST /api/tickets/:id/resolve` — technician/admin marks fixed
- `POST /api/tickets/:id/review` — customer rates the service (closes ticket)

### Appointments
- `POST /api/appointments` — reserve a branch slot
- `GET /api/appointments` — list
- `PATCH /api/appointments/:id` — cancel / complete

### Admin & misc
- `GET /api/technicians` — technicians + active workload
- `GET /api/admin/queue` — full ordered queue for assignment
- `GET /api/notifications` — user notifications (`?unread=1`)
- `PATCH /api/notifications/:id` — mark read
- `GET /api/health` — health check

## Queue & ETA

Waiting tickets (`OPEN`, `ASSIGNED`, `IN_PROGRESS`) are ordered by priority
(`URGENT > HIGH > MEDIUM > LOW`) then FIFO. Position is 1-based; estimated wait =
`peopleAhead × AVG_HANDLE_MINUTES` (env, default 45).

## Example

```bash
# login
TOKEN=$(curl -s localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"password123"}' | jq -r .data.token)

# report a fault
curl -s localhost:3000/api/tickets \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"category":"NO_CONNECTION","description":"No internet since morning","priority":"HIGH"}'
```

## Roadmap (from proposal)

- AI troubleshooting assistant before ticket creation
- WebSocket/SSE push for real-time queue updates (currently poll `GET /api/tickets/:id/queue`)
- SMS/email delivery in `src/lib/notify.ts` (currently in-app only)
