# HRPulse — API Contract

> **Version**: 1.0.0 | **Base URL**: `http://localhost:4000/api`
> This document is the single source of truth for all team members building against the backend.
> Do not guess at data shapes — refer here first.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Leave Requests](#leave-requests)
3. [Common Shapes](#common-shapes)
4. [Error Format](#error-format)
5. [Socket.io Events](#socketio-events)

---

## Authentication

All protected routes require:
```
Authorization: Bearer <access_token>
```
Access tokens expire in **15 minutes**. Use `/auth/refresh` to renew silently.

---

### `POST /auth/signup`
Register a new employee account.

**Request Body**
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

**Field rules**
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
> ⚠️ `_dev_verify_token` is only present when `NODE_ENV !== 'production'`. The token is also logged to the server console.

**Response `409 Conflict`**
```json
{ "error": "An account with these details already exists" }
```

---

### `POST /auth/verify-email`
Activate an account using the verification token.

**Request Body**
```json
{ "token": "uuid-v4-token-from-signup-response-or-console" }
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

### `POST /auth/login`
Authenticate user. Returns access token in body, refresh token in httpOnly cookie.

**Request Body**
```json
{
  "email": "riya@hrpulse.dev",
  "password": "Secret@123"
}
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

**Set-Cookie header (httpOnly)**
```
Set-Cookie: hrpulse_refresh=<refresh_jwt>; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

**Response `401 Unauthorized`** *(wrong credentials or unverified email)*
```json
{ "error": "Invalid email or password" }
```
For unverified email specifically:
```json
{
  "error": "Please verify your email address before logging in",
  "code": "EMAIL_NOT_VERIFIED"
}
```

---

### `POST /auth/refresh`
Get a new access token using the refresh cookie.

**Headers**: Cookie with `hrpulse_refresh` (set automatically by browser/Postman)

**Response `200 OK`**
```json
{ "accessToken": "eyJhbGci..." }
```

**Response `401 Unauthorized`**
```json
{ "error": "Invalid or expired refresh token" }
```

---

### `POST /auth/logout`
Revoke the session. Clears the refresh cookie.

**Headers**: `Authorization: Bearer <access_token>`

**Response `200 OK`**
```json
{ "message": "Logged out successfully" }
```

---

## Leave Requests

### `GET /leave-requests`
**Auth**: Bearer token required

- **Admin**: Returns all leave requests across all employees
- **Employee**: Returns only their own requests

**Query Parameters**
| Param | Type | Example | Description |
|---|---|---|---|
| status | string | `pending` | Filter by status: `pending`, `approved`, `rejected` |
| year | number | `2025` | Filter by the year of `start_date` |

**Response `200 OK`**
```json
{
  "data": [
    {
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
        "id": "clx...",
        "name": "Riya Sharma",
        "employee_id": "EMP001",
        "department": "Engineering",
        "job_title": "Software Engineer",
        "profile_picture_url": null
      },
      "approver": null
    }
  ],
  "count": 1
}
```

---

### `POST /leave-requests`
**Auth**: Bearer token required | Any role

Submit a new leave request.

**Request Body**
```json
{
  "leave_type": "paid",
  "start_date": "2025-06-01T00:00:00.000Z",
  "end_date": "2025-06-05T00:00:00.000Z",
  "remarks": "Family vacation"
}
```

| Field | Required | Values |
|---|---|---|
| leave_type | ✅ | `"paid"`, `"sick"`, `"unpaid"` |
| start_date | ✅ | ISO 8601 datetime |
| end_date | ✅ | ISO 8601 datetime (≥ start_date) |
| remarks | ❌ | Max 500 chars |

**Response `201 Created`**
```json
{ "data": { ...leaveRequest } }
```

**Response `422 Unprocessable Entity`** *(insufficient balance)*
```json
{ "error": "Insufficient leave balance. Requested 5 days but only 3 remaining." }
```

---

### `PATCH /leave-requests/:id/decision`
**Auth**: Bearer token required | **Role: `admin` only**

Approve or reject a pending leave request.

**Request Body**
```json
{
  "status": "approved",
  "comment": "Approved. Enjoy your vacation."
}
```

| Field | Required | Values |
|---|---|---|
| status | ✅ | `"approved"` or `"rejected"` |
| comment | ❌ | Max 500 chars |

**Response `200 OK` — without capacity warning**
```json
{
  "data": {
    "id": "clx...",
    "status": "approved",
    "admin_comment": "Approved. Enjoy your vacation.",
    "approved_by": "clx-admin-id",
    "updated_at": "2025-05-21T09:00:00.000Z",
    "user": { ... },
    "approver": { "id": "clx...", "name": "Admin User", "employee_id": "ADM001" }
  }
}
```

**Response `200 OK` — with capacity warning** *(admin should see caution banner)*
```json
{
  "data": { ...updatedLeaveRequest },
  "warning": true,
  "capacityMessage": "3 of 6 team members already have approved leave overlapping these dates"
}
```

**Response `404 Not Found`**
```json
{ "error": "Leave request not found" }
```

**Response `409 Conflict`** *(already decided)*
```json
{ "error": "Cannot update a request that is already approved" }
```

---

### `DELETE /leave-requests/:id`
**Auth**: Bearer token required | Employee self-cancel only

Cancel a pending leave request (only the owner can cancel, only if `pending`).

**Response `200 OK`**
```json
{ "message": "Leave request cancelled successfully" }
```

---

## Common Shapes

### User (safe — no password_hash)
```json
{
  "id": "clx...",
  "employee_id": "EMP001",
  "name": "Riya Sharma",
  "email": "riya@hrpulse.dev",
  "role": "employee",
  "is_verified": true,
  "phone": "+91-9000000001",
  "address": null,
  "profile_picture_url": null,
  "job_title": "Software Engineer",
  "department": "Engineering",
  "date_of_joining": "2025-01-15T00:00:00.000Z",
  "created_at": "2025-01-15T00:00:00.000Z",
  "updated_at": "2025-01-15T00:00:00.000Z"
}
```

### JWT Access Token Payload (decoded)
```json
{
  "id": "clx...",
  "role": "employee",
  "department": "Engineering",
  "employee_id": "EMP001",
  "iat": 1234567890,
  "exp": 1234568790
}
```

---

## Error Format

All errors follow this shape:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": { "field": ["validation error message"] }
}
```

| Field | Present when |
|---|---|
| `error` | Always |
| `code` | When a machine-readable code helps the client (e.g., `TOKEN_EXPIRED`, `EMAIL_NOT_VERIFIED`) |
| `details` | On Zod validation failures — field-level errors |

**HTTP Status Codes used:**
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (duplicate or invalid state) |
| 422 | Unprocessable (business rule violation) |
| 500 | Internal server error |

---

## Socket.io Events

**Connection**
```js
// Client-side connection (use access token from login)
const socket = io('http://localhost:4000', {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],
});
```

After connecting, the server automatically joins the socket to room `user:{userId}`.

**Events reference**

| Event Name | Direction | Emitted by | Payload Shape |
|---|---|---|---|
| `leave:status:{userId}` | Server → Client | Leave service | `{ requestId, status, comment, updatedAt }` |
| `attendance:update:{userId}` | Server → Client | Attendance module | `{ date, checkIn, checkOut, status }` |
| `notification:new:{userId}` | Server → Client | Any service | `{ id, type, message, read, createdAt }` |
| `payroll:processed:{userId}` | Server → Client | Payroll module | `{ month, year, netPay }` |

**Listening example (frontend)**
```js
socket.on(`leave:status:${user.id}`, (payload) => {
  console.log('Leave decision received:', payload);
  // { requestId: 'clx...', status: 'approved', comment: '...', updatedAt: '...' }
});
```

**Emitting from another backend module (e.g., Attendance)**
```js
const { getIO, SOCKET_EVENTS } = require('../../sockets');

// After updating attendance record:
getIO()
  .to(`user:${userId}`)
  .emit(SOCKET_EVENTS.attendanceUpdate(userId), {
    date: '2025-06-01',
    checkIn: '09:02:00',
    checkOut: null,
    status: 'present',
  });
```

---

*Last updated: 2026-07-04 | Module owner: Auth/Schema/Leave/Sockets*
