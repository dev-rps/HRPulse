# HRPulse — Project Plan (Single Source of Truth)

> **Last updated: 2026-07-04 by team lead.**
> If something here conflicts with the live code, **the code wins** — flag the discrepancy so this doc gets corrected immediately.

> **How to use this file:** Pull `origin/main` and read this instead of relying on anything pasted in chat. Every section below reflects what is *actually built and committed*, not what was originally proposed.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Database Schema](#2-database-schema)
3. [Design Tokens](#3-design-tokens)
4. [API Contract](#4-api-contract)
5. [Socket.io Delivery Pattern](#5-socketio-delivery-pattern)
6. [File Structure](#6-file-structure)
7. [File Ownership Map](#7-file-ownership-map)
8. [Git Workflow](#8-git-workflow)

---

## 1. Tech Stack

### Backend
- **Runtime**: Node.js ≥ 18
- **Framework**: Express 4.x
- **Architecture**: layered `Controller → Service → (Prisma queries)` — no repository abstraction layer, Prisma client is called directly in service files
- **Validation**: Zod (server-side on every input, even if frontend also validates — never trust client input)
- **Password hashing**: bcryptjs, 12 rounds
- **ORM**: Prisma 5.22.0 (pinned — do NOT upgrade to Prisma 7 without team-lead approval; v7 broke the `url = env()` datasource syntax)

### Database
- **Engine**: PostgreSQL 16 (Docker image: `postgres:16-alpine`)
- **ORM**: Prisma 5.22.0 (schema at `backend/prisma/schema.prisma`)
- **Local dev**: `docker compose up -d` starts Postgres on port 5432 (credentials in `.env.example`)
- **Production (Vercel)**: Production deployments MUST use a pooled connection string (e.g., Neon connection string ending with `?pgbouncer=true` or Supabase pooled connection string on port `6543`) to prevent database connection pool exhaustion under the serverless function lifecycle.

### Real-time
- **Library**: Socket.io 4.x (same HTTP server as Express — no separate port)
- **Pattern**: rooms + namespaced events (see [Section 5](#5-socketio-delivery-pattern))

### Frontend
- **Bundler**: Vite
- **UI Library**: React (JavaScript — no TypeScript)
- **Styling**: Tailwind CSS, configured via `tailwind.config.js` which reads from `tokens.css` CSS custom properties
- **Design tokens**: `tokens.css` is the **single source of truth** for all colors, spacing, radius, and typography — see [Section 3](#3-design-tokens)
- **Routing**: `react-router-dom`

### Auth
- **Tokens**: JWT — access token (15 min) + refresh token (7 days)
- **Frontend storage**: access token in `sessionStorage`; refresh token in `httpOnly` cookie (set by backend, not readable by JS)
- **Hashing**: refresh tokens are SHA-256 hashed before storing in the `sessions` table — raw token is never persisted

### Constraints
- **No BaaS**: Firebase, Supabase, and Mongo Atlas are banned. All data lives in our PostgreSQL instance.
- **No new dependencies** without team-lead approval — announce in the group, get a nod, then add.

---

## 2. Database Schema

> **Source of truth**: `backend/prisma/schema.prisma` — reproduced verbatim below.
> Do not use this section to infer what fields exist — always read the actual file before writing a query.

### Enums

```prisma
enum Role {
  admin
  employee
}

// Prisma enum values cannot contain hyphens.
// half_day is stored in the DB as "half-day" via @map.
enum AttendanceStatus {
  present
  absent
  half_day @map("half-day")
  leave
}

enum LeaveType {
  paid
  sick
  unpaid
}

enum LeaveStatus {
  pending
  approved
  rejected
}
```

### Models

```prisma
model User {
  id                  String    @id @default(cuid())
  employee_id         String    @unique
  name                String
  email               String    @unique
  password_hash       String
  role                Role      @default(employee)
  is_verified         Boolean   @default(false)
  phone               String?
  address             String?
  profile_picture_url String?
  job_title           String?
  department          String?
  date_of_joining     DateTime?
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  salary_structures    SalaryStructure[]
  attendance           Attendance[]
  leave_requests       LeaveRequest[]     @relation("UserLeaveRequests")
  approved_leaves      LeaveRequest[]     @relation("ApproverLeaveRequests")
  leave_balances       LeaveBalance[]
  documents            Document[]
  notifications        Notification[]
  audit_logs           AuditLog[]
  sessions             Session[]
  email_verifications  EmailVerification[]

  @@map("users")
}

model SalaryStructure {
  id             String   @id @default(cuid())
  user_id        String
  basic          Decimal  @db.Decimal(12, 2)
  hra            Decimal  @db.Decimal(12, 2)
  allowances     Decimal  @db.Decimal(12, 2)
  deductions     Decimal  @db.Decimal(12, 2)
  net_salary     Decimal  @db.Decimal(12, 2)
  effective_from DateTime
  created_at     DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([effective_from])
  @@map("salary_structures")
}
// DESIGN RATIONALE: rows are NEVER overwritten. A new row is inserted on every
// raise. This gives a full compensation history for audits without losing data.

model Attendance {
  id             String           @id @default(cuid())
  user_id        String
  date           DateTime         @db.Date
  check_in_time  DateTime?
  check_out_time DateTime?
  status         AttendanceStatus
  synced_offline Boolean          @default(false)
  created_at     DateTime         @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, date])   // one record per person per day — enforced at DB level
  @@index([user_id])
  @@index([date])
  @@map("attendance")
}

model LeaveRequest {
  id            String      @id @default(cuid())
  user_id       String
  leave_type    LeaveType
  start_date    DateTime    @db.Date
  end_date      DateTime    @db.Date
  remarks       String?
  status        LeaveStatus @default(pending)
  approved_by   String?     // FK → users.id; null until admin acts
  admin_comment String?
  created_at    DateTime    @default(now())
  updated_at    DateTime    @updatedAt

  user     User  @relation("UserLeaveRequests", fields: [user_id], references: [id], onDelete: Cascade)
  approver User? @relation("ApproverLeaveRequests", fields: [approved_by], references: [id])

  @@index([user_id])
  @@index([start_date, end_date])   // used by team capacity check query
  @@index([status])
  @@map("leave_requests")
}

model LeaveBalance {
  id         String    @id @default(cuid())
  user_id    String
  leave_type LeaveType
  total_days Int
  used_days  Int       @default(0)
  year       Int

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, leave_type, year])   // one row per person per type per year
  @@map("leave_balances")
}
// DESIGN RATIONALE: kept separate from leave_requests so balance queries
// are a single row lookup, not a full table scan. Also enables the
// team-capacity-check feature without double-counting.

model Document {
  id          String   @id @default(cuid())
  user_id     String
  doc_type    String
  file_url    String
  uploaded_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("documents")
}

model Notification {
  id         String   @id @default(cuid())
  user_id    String
  type       String
  message    String
  is_read    Boolean  @default(false)
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, is_read])   // fast unread-count queries
  @@map("notifications")
}

model AuditLog {
  id        String   @id @default(cuid())
  actor_id  String   // the admin who acted
  action    String   // e.g. "LEAVE_APPROVED", "LEAVE_REJECTED", "USER_CREATED"
  entity    String   // e.g. "leave_requests", "users"
  entity_id String   // PK of the affected row
  timestamp DateTime @default(now())

  actor User @relation(fields: [actor_id], references: [id])

  @@index([actor_id])
  @@index([entity, entity_id])
  @@map("audit_log")
}
// DESIGN RATIONALE: every admin action is permanently recorded. Judges score
// security and scalability, not just features.

// ── Auth infrastructure — internal to the Auth module only ──────────────────

model Session {
  id         String   @id @default(cuid())
  user_id    String
  token_hash String   // SHA-256 of the refresh JWT — raw token never persisted
  expires_at DateTime
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("sessions")
}

model EmailVerification {
  id         String   @id @default(cuid())
  user_id    String
  token      String   @unique   // UUID v4, one-time use
  expires_at DateTime
  used       Boolean  @default(false)

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("email_verifications")
}
```

---

## 3. Design Tokens

> ⚠️ **`tokens.css` does not exist yet in the repo** — it is Member 1's first task.
> The specification below is agreed and locked. Member 1 creates the file; all other members consume it.

### Rule — enforced for the whole team:
**`tokens.css` is the ONLY place colors are defined. No team member hardcodes a hex value, `rgb()`, or `hsl()` anywhere else in the codebase — not in JSX, not in Tailwind classes, not in inline styles.** Use the CSS custom property or the Tailwind token that maps to it.

### `frontend/src/tokens.css` (to be created by Member 1)

```css
:root {
  /* ── Brand ──────────────────────────────────────────────────── */
  --color-primary:       #2563EB;   /* blue-600  — buttons, links, active states  */
  --color-primary-hover: #1D4ED8;   /* blue-700  — hover on primary               */
  --color-primary-light: #DBEAFE;   /* blue-100  — backgrounds, badges            */

  /* ── Accent — use ONLY for live/status indicators ─────────── */
  --color-accent:        #F43F5E;   /* rose-500  — live dot, urgent alerts only   */

  /* ── Semantic ───────────────────────────────────────────────── */
  --color-success:       #10B981;   /* emerald-500 */
  --color-success-light: #D1FAE5;   /* emerald-100 */
  --color-warning:       #F59E0B;   /* amber-500   */
  --color-warning-light: #FEF3C7;   /* amber-100   */
  --color-error:         #EF4444;   /* red-500     */
  --color-error-light:   #FEE2E2;   /* red-100     */

  /* ── Neutrals ───────────────────────────────────────────────── */
  --color-bg:            #F8FAFC;   /* slate-50  — page background    */
  --color-surface:       #FFFFFF;   /* white     — cards, modals      */
  --color-border:        #E2E8F0;   /* slate-200 — dividers           */
  --color-text:          #0F172A;   /* slate-900 — body copy          */
  --color-text-muted:    #64748B;   /* slate-500 — labels, captions   */
  --color-text-inverse:  #FFFFFF;   /* on dark backgrounds            */

  /* ── Typography ─────────────────────────────────────────────── */
  --font-sans:   'Inter', system-ui, sans-serif;
  --font-size-xs:   0.75rem;    /* 12px */
  --font-size-sm:   0.875rem;   /* 14px */
  --font-size-base: 1rem;       /* 16px */
  --font-size-lg:   1.125rem;   /* 18px */
  --font-size-xl:   1.25rem;    /* 20px */
  --font-size-2xl:  1.5rem;     /* 24px */
  --font-size-3xl:  1.875rem;   /* 30px */

  /* ── Border radius ──────────────────────────────────────────── */
  --radius-sm:  0.25rem;    /* 4px  */
  --radius-md:  0.5rem;     /* 8px  */
  --radius-lg:  0.75rem;    /* 12px */
  --radius-xl:  1rem;       /* 16px */
  --radius-full: 9999px;

  /* ── Spacing scale (matches Tailwind 4-unit grid) ───────────── */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* ── Shadows ────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
}
```

### `tailwind.config.js` wiring (Member 1 sets this up)
```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:       'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-light': 'var(--color-primary-light)',
        accent:        'var(--color-accent)',
        success:       'var(--color-success)',
        warning:       'var(--color-warning)',
        error:         'var(--color-error)',
        bg:            'var(--color-bg)',
        surface:       'var(--color-surface)',
        border:        'var(--color-border)',
        text:          'var(--color-text)',
        'text-muted':  'var(--color-text-muted)',
      },
      fontFamily: { sans: 'var(--font-sans)' },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
};
```

---

## 4. API Contract

> Full contents of `docs/api-contract.md` — reproduced here for self-containment.
> Base URL: `http://localhost:4000/api`
> All protected routes require: `Authorization: Bearer <access_token>`
> Access tokens expire in **15 minutes** — use `/auth/refresh` to renew.

### ✅ Built and live

---

#### `POST /auth/signup`
Register a new user account.

**Request body**
```json
{
  "employee_id": "EMP001",
  "name": "Riya Sharma",
  "email": "riya@hrpulse.dev",
  "password": "Secret@123",
  "role": "employee",
  "phone": "+91-9000000001",
  "department": "Engineering",
  "job_title": "Software Engineer",
  "date_of_joining": "2025-01-15T00:00:00.000Z"
}
```

| Field | Required | Rules |
|---|---|---|
| employee_id | ✅ | Unique across org |
| name | ✅ | Min 1 char |
| email | ✅ | Valid email, unique |
| password | ✅ | Min 8 chars, ≥1 digit, ≥1 special char |
| role | ❌ | `"admin"` or `"employee"` (default: `"employee"`) |
| phone, department, job_title, date_of_joining | ❌ | Optional |

**Response `201 Created`**
```json
{
  "message": "Account created. Please verify your email to continue.",
  "userId": "clx...",
  "_dev_verify_token": "uuid-v4-token",
  "_dev_note": "This field is only present in non-production environments."
}
```
> `_dev_verify_token` only present when `NODE_ENV !== 'production'`. Token also logged to server console.

**Response `409 Conflict`**
```json
{ "error": "An account with these details already exists" }
```

---

#### `POST /auth/verify-email`
Activate account using the verification token.

**Request body**
```json
{ "token": "uuid-v4-token" }
```

**Response `200 OK`**
```json
{ "message": "Email verified successfully. You can now log in." }
```

**Response `400 Bad Request`**
```json
{ "error": "Invalid or expired verification token" }
```

---

#### `POST /auth/login`
Authenticate. Returns access token in body + refresh token in httpOnly cookie.

**Request body**
```json
{ "email": "riya@hrpulse.dev", "password": "Secret@123" }
```

**Response `200 OK`**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGci...",
  "user": {
    "id": "clx...",
    "employee_id": "EMP001",
    "name": "Riya Sharma",
    "email": "riya@hrpulse.dev",
    "role": "employee",
    "department": "Engineering",
    "job_title": "Software Engineer",
    "profile_picture_url": null,
    "is_verified": true,
    "created_at": "2025-01-15T00:00:00.000Z"
  }
}
```

**Set-Cookie (httpOnly)**
```
Set-Cookie: hrpulse_refresh=<jwt>; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

**Response `401`** — wrong credentials:
```json
{ "error": "Invalid email or password" }
```

**Response `401`** — unverified email:
```json
{ "error": "Please verify your email address before logging in", "code": "EMAIL_NOT_VERIFIED" }
```

---

#### `POST /auth/refresh`
Exchange a valid refresh cookie for a new access token.

**Response `200 OK`**
```json
{ "accessToken": "eyJhbGci..." }
```

---

#### `POST /auth/logout`
Delete the session. Clears refresh cookie.

**Headers**: `Authorization: Bearer <access_token>`

**Response `200 OK`**
```json
{ "message": "Logged out successfully" }
```

---

#### `GET /leave-requests`
**Auth**: Bearer | Admin sees all; Employee sees own only (enforced in service, not just frontend).

**Query params**: `?status=pending&year=2025`

**Response `200 OK`**
```json
{
  "data": [{
    "id": "clx...",
    "user_id": "clx...",
    "leave_type": "paid",
    "start_date": "2025-06-01T00:00:00.000Z",
    "end_date": "2025-06-05T00:00:00.000Z",
    "remarks": "Family vacation",
    "status": "pending",
    "approved_by": null,
    "admin_comment": null,
    "created_at": "2025-05-20T10:00:00.000Z",
    "updated_at": "2025-05-20T10:00:00.000Z",
    "user": {
      "id": "clx...", "name": "Riya Sharma", "employee_id": "EMP001",
      "department": "Engineering", "job_title": "Software Engineer",
      "profile_picture_url": null
    },
    "approver": null
  }],
  "count": 1
}
```

---

#### `POST /leave-requests`
**Auth**: Bearer | Any role

**Request body**
```json
{
  "leave_type": "paid",
  "start_date": "2025-06-01T00:00:00.000Z",
  "end_date": "2025-06-05T00:00:00.000Z",
  "remarks": "Family vacation"
}
```

**Response `201 Created`**: `{ "data": { ...leaveRequest } }`

**Response `422`** — insufficient balance:
```json
{ "error": "Insufficient leave balance. Requested 5 days but only 3 remaining." }
```

---

#### `PATCH /leave-requests/:id/decision`
**Auth**: Bearer | **Role: `admin` only**

**Request body**
```json
{ "status": "approved", "comment": "Approved. Enjoy your vacation." }
```

**Response `200 OK`** — no capacity issue:
```json
{
  "data": {
    "id": "clx...", "status": "approved",
    "admin_comment": "Approved. Enjoy your vacation.",
    "approved_by": "clx-admin-id",
    "updated_at": "2025-05-21T09:00:00.000Z",
    "user": { ... },
    "approver": { "id": "clx...", "name": "Admin User", "employee_id": "ADM001" }
  }
}
```

**Response `200 OK`** — with capacity warning (render as caution banner in UI):
```json
{
  "data": { ...updatedLeaveRequest },
  "warning": true,
  "capacityMessage": "3 of 6 team members already have approved leave overlapping these dates"
}
```

**Response `404`**: `{ "error": "Leave request not found" }`
**Response `409`**: `{ "error": "Cannot update a request that is already approved" }`

---

#### `DELETE /leave-requests/:id`
**Auth**: Bearer | Employee self-cancel only (pending requests only — enforced in service)

**Response `200 OK`**: `{ "message": "Leave request cancelled successfully" }`

---

### ⚠️ Planned but NOT YET BUILT

| Endpoint | Module | Owner |
|---|---|---|
| `GET /attendance` | Attendance | Member 2 |
| `POST /attendance/check-in` | Attendance | Member 2 |
| `POST /attendance/check-out` | Attendance | Member 2 |
| `GET /salary-structures/:userId` | Payroll | Member 3 |
| `POST /salary-structures` | Payroll | Member 3 |
| `GET /payroll/payslip/:userId/:month` | Payroll | Member 3 |
| `GET /users/:id` | Auth/Admin | Team Lead |
| `PATCH /users/:id` | Auth/Admin | Team Lead |
| `GET /notifications/:userId` | Notifications | Member 1 |
| `PATCH /notifications/:id/read` | Notifications | Member 1 |

When building these, follow the same pattern: Controller → Service → Prisma. Document in `docs/api-contract.md` when implemented.

---

### Common shapes

**JWT access token payload (decoded)**
```json
{ "id": "clx...", "role": "employee", "department": "Engineering", "employee_id": "EMP001", "iat": 0, "exp": 0 }
```

**Error envelope (all errors)**
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": { "fieldName": ["validation error"] }
}
```

| HTTP code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation error (Zod) |
| 401 | Unauthenticated / expired token |
| 403 | Wrong role |
| 404 | Not found |
| 409 | Conflict / invalid state |
| 422 | Business rule violation |
| 500 | Internal server error |

---

## 5. Socket.io Delivery Pattern

> **Confirmed from actual source** — `backend/src/sockets/index.js` line 86 and `backend/src/modules/leave-approval/leave.service.js` lines 349–354.

### The pattern: rooms + namespaced event names (hybrid)

**On every authenticated connect** (sockets/index.js:86):
```js
socket.join(`user:${userId}`);
```
Each user's socket is placed into a personal room named `user:{userId}`. If the same user has two tabs open, both sockets are in the same room and both receive the event.

**On every server emit** (e.g., leave.service.js:351):
```js
io.to(`user:${leaveRequest.user_id}`).emit(
  `leave:status:${leaveRequest.user_id}`,
  payload
);
```

Two things happen together:
1. `.to(`user:${userId}`)` — **room targeting**: delivery is scoped to that user's room
2. `` `leave:status:${userId}` `` — **namespaced event name**: the event name itself contains the userId

### What this means for frontend developers

**Connect (once, after login):**
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: sessionStorage.getItem('accessToken') },
  transports: ['websocket', 'polling'],
});
```

**Listen for events (use your own userId in the event name):**
```js
// The server already scoped delivery via the room.
// You do NOT need to filter by userId in the handler — if this fires, it's yours.
socket.on(`leave:status:${user.id}`, (payload) => {
  // payload: { requestId, status, comment, updatedAt }
  updateLeaveStatus(payload);
});

socket.on(`notification:new:${user.id}`, (payload) => {
  // payload: { id, type, message, read, createdAt }
  addNotification(payload);
});
```

**You do NOT need to:**
- Manually join a room (`socket.join` is server-side only)
- Filter `payload.userId === myId` — the room already ensures you only receive your events
- Reconnect on every page — keep the socket instance in a React context

### All implemented events

| Event name | Direction | Currently emitted from | Payload shape |
|---|---|---|---|
| `` `leave:status:${userId}` `` | Server → Client | `leave.service.js` → `makeDecision()` | `{ requestId, status, comment, updatedAt }` |
| `` `notification:new:${userId}` `` | Server → Client | `leave.service.js` → `submitLeaveRequest()` | `{ id, type, message, read, createdAt }` |
| `` `attendance:update:${userId}` `` | Server → Client | **Not yet emitted** — reserved for Member 2 | `{ date, checkIn, checkOut, status }` |
| `` `payroll:processed:${userId}` `` | Server → Client | **Not yet emitted** — reserved for Member 3 | `{ month, year, netPay }` |

### How other backend modules emit (Members 2 & 3)

```js
const { getIO, SOCKET_EVENTS } = require('../../sockets');

// After saving an attendance record:
getIO()
  .to(`user:${userId}`)
  .emit(SOCKET_EVENTS.attendanceUpdate(userId), {
    date: '2025-06-01',
    checkIn: '09:02:00',
    checkOut: null,
    status: 'present',
  });
```

`SOCKET_EVENTS` is exported from `backend/src/sockets/index.js`. Use it — don't hand-write event name strings, typos break silent.

---

## 6. File Structure

> Actual repo tree as of last push. Frontend does not exist yet — Member 1 creates it.

```
HRPulse/                              ← repo root
├── .gitignore
├── README.md
├── docker-compose.yml                ← postgres:16-alpine on :5432
├── docs/
│   ├── api-contract.md               ← endpoint reference (Team Lead)
│   └── project-plan.md               ← this file (Team Lead)
└── backend/
    ├── .env.example                  ← copy to .env, never commit .env
    ├── nodemon.json
    ├── package.json                  ← Prisma pinned at 5.22.0
    ├── package-lock.json             ← COMMITTED — use npm ci for clean installs
    ├── prisma/
    │   └── schema.prisma             ← DB contract (Team Lead owns)
    └── src/
        ├── app.js                    ← Express factory (CORS, routes, error handler)
        ├── server.js                 ← HTTP server + Socket.io bootstrap
        ├── lib/
        │   ├── prisma.js             ← singleton PrismaClient
        │   └── jwt.js                ← token sign/verify helpers
        ├── auth/
        │   ├── auth.routes.js
        │   ├── auth.controller.js
        │   ├── auth.service.js       ← signup, login, refresh, logout logic
        │   └── auth.schema.js        ← Zod schemas (password rules etc.)
        ├── middleware/
        │   ├── requireAuth.js        ← Bearer JWT guard → sets req.user
        │   └── requireRole.js        ← RBAC factory guard
        ├── modules/
        │   ├── leave-approval/       ← Team Lead owns
        │   │   ├── leave.routes.js
        │   │   ├── leave.controller.js
        │   │   └── leave.service.js  ← capacity check, audit log, socket emit
        │   ├── attendance/           ← Member 2 creates this
        │   └── payroll/              ← Member 3 creates this
        └── sockets/
            └── index.js              ← JWT handshake, rooms, SOCKET_EVENTS constants
```

**Frontend (to be created by Member 1):**
```
frontend/                             ← Vite + React project root
├── index.html
├── vite.config.js
├── tailwind.config.js                ← reads from tokens.css
├── package.json
└── src/
    ├── main.jsx
    ├── tokens.css                    ← CSS custom properties (Member 1 creates)
    ├── App.jsx
    ├── router.jsx                    ← react-router-dom routes
    ├── contexts/
    │   ├── AuthContext.jsx           ← stores user, accessToken, socket instance
    │   └── SocketContext.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx             ← Member 1
    │   ├── Attendance.jsx            ← Member 2
    │   ├── LeaveApplication.jsx      ← Member 3
    │   ├── Payroll.jsx               ← Member 3
    │   └── Profile.jsx               ← Member 1
    └── components/
        └── ...
```

---

## 7. File Ownership Map

> If your task requires touching a file in someone else's lane, **stop and flag it in the group chat first**. Do not edit and apologise later — that creates merge conflicts.

| Owner | Files / Folders | Notes |
|---|---|---|
| **Team Lead** | `backend/prisma/schema.prisma` | Schema changes need team-wide announcement first |
| **Team Lead** | `backend/src/auth/*` | |
| **Team Lead** | `backend/src/middleware/*` | |
| **Team Lead** | `backend/src/modules/leave-approval/*` | |
| **Team Lead** | `backend/src/sockets/index.js` | |
| **Team Lead** | `backend/src/lib/*`, `backend/src/app.js`, `backend/src/server.js` | Core infra |
| **Team Lead** | `docs/api-contract.md`, `docs/project-plan.md` | |
| **Member 1** | `frontend/src/tokens.css` | **First task — blocks everyone else's styling** |
| **Member 1** | `frontend/tailwind.config.js` | |
| **Member 1** | `frontend/src/pages/Dashboard.jsx` | |
| **Member 1** | `frontend/src/pages/Profile.jsx` | |
| **Member 1** | `frontend/src/contexts/*` | AuthContext, SocketContext |
| **Member 1** | `frontend/src/components/layout/*` | Sidebar, Navbar, shell |
| **Member 2** | `backend/src/modules/attendance/*` | Create the folder |
| **Member 2** | `frontend/src/pages/Attendance.jsx` | |
| **Member 3** | `backend/src/modules/payroll/*` | Create the folder |
| **Member 3** | `frontend/src/pages/LeaveApplication.jsx` | |
| **Member 3** | `frontend/src/pages/Payroll.jsx` | |

### Shared files — flag before touching

| File | Who to flag |
|---|---|
| `backend/prisma/schema.prisma` | Team Lead — any new field/model needs migration |
| `backend/src/app.js` | Team Lead — adding a new route mount |
| `frontend/src/router.jsx` | Member 1 — adding a new page route |
| `frontend/src/tokens.css` | Member 1 — adding a new token |
| `docs/api-contract.md` | Team Lead — documenting a new endpoint |

---

## 8. Git Workflow

1. **Single branch: `main`** — no feature branches, ever.
2. **Pull before starting any work:**
   ```bash
   git pull origin main
   ```
   If you cannot pull (network, auth), **stop and tell the team** — do not work on stale code.
3. **Commit in small, working increments** — not one giant commit at the end.
4. **Conventional commit format** — no exceptions:
   ```
   feat(module): short description
   fix(module): short description
   refactor(module): short description
   chore(infra): short description
   docs(scope): short description
   ```
   Module names: `auth`, `schema`, `middleware`, `leave`, `attendance`, `payroll`, `sockets`, `infra`, `api`, `dashboard`, `profile`
5. **Test before every push:**
   - Backend: `npm run dev` must start without errors
   - Never push code that breaks the build
6. **Pull again immediately before pushing:**
   ```bash
   git pull origin main   # resolve conflicts locally first
   git push origin main
   ```
7. **No force-push** — ever. If you think you need it, ask the team lead first.
8. **No unattended auto-push** — always review your own diff (`git diff --cached`) before committing.
9. **`package-lock.json` is committed** — if you run `npm install <package>`, commit the updated lock file in the same commit as `package.json`.
10. **`.env` is never committed** — use `.env.example` as the template.

---

*Document maintained by team lead. Last code-verified: 2026-07-04.*
