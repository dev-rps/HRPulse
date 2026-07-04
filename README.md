# HRPulse — HRMS

> Hackathon project for Odoo × Adamas. Real-time HR management system with leave approval, attendance tracking, payroll, and notifications.

## 🔗 Live Link & Demo Video
* **Live Deployment**: [https://hr-pulse-three.vercel.app](https://hr-pulse-three.vercel.app)
* **Demo Video Walkthrough**: [Watch Walkthrough Video](https://github.com/user-attachments/assets/b23af00a-d808-4adc-a5ac-9add268138ec)

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Docker (for local Postgres) **or** an existing PostgreSQL instance

### 1. Start the database
```bash
docker compose up -d
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env if your DB credentials differ
```

### 3. Install dependencies & migrate
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run the dev server
```bash
npm run dev
# → Server listening on http://localhost:4000
```

## API Documentation
See [`/docs/api-contract.md`](./docs/api-contract.md) — full endpoint reference for all team members.

## Module Ownership
| Module | Owner | Files |
|---|---|---|
| Auth / Schema / Leave / Sockets | Member 4 | `/backend/src/auth/*`, `/backend/src/middleware/*`, `/backend/prisma/schema.prisma`, `/backend/src/modules/leave-approval/*`, `/backend/src/sockets/index.js` |
| Dashboard / Admin UI | Member 1 | TBD |
| Attendance | Member 2 | TBD |
| Payroll | Member 3 | TBD |

## Socket.io Event Reference
| Event | Emitter | Payload |
|---|---|---|
| `leave:status:{userId}` | Leave service | `{ requestId, status, comment, updatedAt }` |
| `attendance:update:{userId}` | Attendance module | `{ date, checkIn, checkOut, status }` |
| `notification:new:{userId}` | Any service | `{ id, type, message, read, createdAt }` |
| `payroll:processed:{userId}` | Payroll module | `{ month, year, netPay }` |

## Git Discipline
- Single branch: `main`
- Conventional commits: `feat(module): description`
- Pull before every push — no force-push
