# Chatapp API

[![CI](https://github.com/karansnarula/chat-app-api/actions/workflows/ci.yml/badge.svg)](https://github.com/karansnarula/chat-app-api/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-24%20passing-success)
![Deployed](https://img.shields.io/badge/deployed-Render-46E3B7)

A production-grade real-time chat backend built with NestJS, demonstrating REST APIs, WebSocket real-time communication, and push notifications with a security-first, layered architecture.

**Live API:** [https://chat-app-api-ayhv.onrender.com](https://chat-app-api-ayhv.onrender.com)
**Swagger Docs:** [https://chat-app-api-ayhv.onrender.com/api-docs](https://chat-app-api-ayhv.onrender.com/api-docs)

---

## Overview

Chatapp is a WhatsApp-style messaging backend. Users register, add friends by email (request/accept flow), create one-on-one conversations, and exchange messages in real time. Messages are delivered instantly via WebSocket when the recipient is online, and fall back to a push notification (FCM) when they're not.

A mobile frontend consuming this API is planned as the next phase.

## Features

- **Authentication** — Email/password registration and login, JWT access (15 min) + refresh (7 day) tokens with separate signing secrets, logout endpoint
- **Friends** — Add a friend by email, accept/decline requests, list friends — all with real-time in-app notification via WebSocket when a request arrives
- **Conversations** — One-on-one conversations created only between confirmed friends, listed with the other participant and last message preview
- **Messages** — Send, cursor-paginated history, read receipts — real-time delivery via WebSocket when the recipient is online, with FCM push notification fallback when they're not
- **WebSocket Gateway** — JWT-authenticated Socket.io connections; `message:send`, `message:read`, and `friend:request` events, all backed by the same service layer as the REST endpoints (no duplicated business logic)
- **Push Notifications** — Firebase Cloud Messaging, credentials loaded from an environment variable (not a file) so the same code works identically in Docker and on Render
- **Production Hardening** — Global exception filter (no internal errors leaked to clients), rate limiting (5 login attempts / 15 min, 100 requests / min globally), environment variable validation with Joi (fails fast on misconfiguration), structured request logging, Swagger docs
- **Testing** — 24 unit tests across Auth, Friends, and Messages services covering security checks, authorization boundaries, transactions, and pagination edge cases

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | NestJS (TypeScript) | Structured, DI-based architecture with modules, controllers, services, guards, and interceptors |
| Database | PostgreSQL + Prisma (driver adapter) | Type-safe queries, migrations; Prisma 7's adapter-based client works identically across local Docker and Render |
| Real-time | Socket.io (`@nestjs/websockets`) | JWT-authenticated gateway; in-memory `userId → socketId` map for targeted delivery |
| Auth | Passport + `@nestjs/jwt` | Separate access/refresh strategies and guards; `bcrypt` for password hashing |
| Push | `firebase-admin` | Credentials passed as a JSON string via `FIREBASE_SERVICE_ACCOUNT` env var, not a committed file |
| Validation | `class-validator` / `class-transformer` | DTO-based request validation with a global `whitelist`/`forbidNonWhitelisted` pipe |
| Env Validation | Joi | Schema-validates `.env` at boot; app refuses to start with a clear error if misconfigured |
| Rate Limiting | `@nestjs/throttler` | Global default + a stricter per-route override on `/auth/login` |
| Docs | `@nestjs/swagger` | Interactive docs at `/api-docs` |
| Testing | Jest + mocked `PrismaService`/`MessagesGateway` | Unit tests isolate service logic from the database entirely |
| Containerization | Docker (multi-stage build) | Same image runs locally and on Render |
| CI/CD | GitHub Actions | Spins up a real Postgres service container, runs migrations, lint, and tests on every push/PR |

## Architecture

Each feature is a self-contained module: `controller` (HTTP), `service` (business logic + Prisma access), and where relevant a `gateway` (WebSocket). No repository/use-case abstraction layer — Prisma's client already provides the data-access abstraction, so an extra layer would be indirection without benefit for a project this size. Authorization checks (e.g. "is this user actually a participant in this conversation?") live in the service, not the controller.

```
src/
├── auth/               # register, login, refresh, logout, guards, JWT strategies
├── users/               # profile, FCM token registration
├── friends/             # request/accept/decline, list — notifies via MessagesGateway
├── conversations/       # create (friends only), list with last message
├── messages/            # send, cursor pagination, read receipts, WebSocket gateway
├── fcm/                 # push notification service
├── prisma/              # PrismaService (driver-adapter based)
├── common/
│   ├── filters/         # global exception filter
│   └── interceptors/    # request logging
└── config/
    └── env.validation.ts
```

**Cross-feature communication:** `FriendsService` has `MessagesGateway` constructor-injected and calls `notifyFriendRequest()` directly after creating a friend request — a straightforward method call rather than an abstraction layer, since this is the only place that needs to trigger it.

**Real-time + push decision:** on every `message:send`, the gateway checks its in-memory socket map for the recipient. Connected → WebSocket push. Not connected → FCM push notification (if they have a token registered). This logic lives once, in the gateway, reusing `MessagesService` for all persistence — REST and WebSocket message-sending share the exact same save path.

## API Overview

```
Auth          POST /auth/register · /auth/login · /auth/refresh · /auth/logout · GET /auth/me
Users         GET/PATCH /users/me · PATCH /users/me/fcm-token
Friends       POST /friends/request · PATCH /friends/request/:id/respond · GET /friends/requests · GET /friends
Conversations POST /conversations · GET /conversations
Messages      POST /messages/:conversationId · GET /messages/:conversationId (cursor paginated) · PATCH /messages/:conversationId/read

WebSocket     message:send · message:read · message:new (server→client) · message:read (server→client) · friend:request (server→client)
```

Full request/response shapes: see Swagger at `/api-docs`.

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for local PostgreSQL)
- A Firebase project with a service account key (for FCM)

### Setup

```bash
git clone https://github.com/karansnarula/chat-app-api.git
cd chat-app-api
npm install

# Start a local Postgres container
docker run --name chat-app-db \
  -e POSTGRES_USER=karan -e POSTGRES_PASSWORD=password123 -e POSTGRES_DB=chat_app_dev \
  -p 5432:5432 -d postgres:16
```

Create `.env` in the project root:

```dotenv
DATABASE_URL=postgresql://karan:password123@localhost:5432/chat_app_dev
JWT_ACCESS_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>
FIREBASE_SERVICE_ACCOUNT=<entire service account JSON as a single line — cat file.json | jq -c .>
PORT=3000
```

No quotes around values — this file is read directly by `@nestjs/config`, and quotes are treated as literal characters (this bit us once; see commit history).

```bash
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Swagger available at `http://localhost:3000/api-docs`.

### Running Tests

```bash
npm run test           # 24 unit tests, no database required (Prisma/Gateway are mocked)
npm run lint:ci         # CI-mode lint (no auto-fix)
```

### Docker

```bash
docker build -t chat-app-api .
docker run -p 3000:3000 --env-file .env chat-app-api
```

Note: on macOS/Linux with a local Postgres container, use `host.docker.internal` in place of `localhost` in `DATABASE_URL` when running the app in Docker — the container can't reach `localhost` on your host machine otherwise.

## Deployment

Deployed on **Render** (free tier) — a Docker-based web service plus a managed PostgreSQL instance. `FIREBASE_SERVICE_ACCOUNT` is stored as a raw JSON-string environment variable rather than a file, since the credentials file is git-ignored and never reaches Render's build context.

**Known limitation:** the free tier doesn't support pre-deploy commands, so Prisma migrations aren't run automatically on deploy. After a schema change, migrations are applied manually against production:

```bash
DATABASE_URL=<render_external_db_url> npx prisma migrate deploy
```

## CI

`.github/workflows/ci.yml` runs on every push/PR to `develop` and `main`: spins up a Postgres service container, installs dependencies, generates the Prisma client, applies migrations, lints, runs all tests, and builds — all before code can merge.

## Roadmap

- Mobile frontend consuming this API end-to-end
- Automated migrations on deploy (requires a paid Render tier, or a manual GitHub Actions deploy step)
- Integration tests against a real (ephemeral) database, exercising the WebSocket gateway directly
- Voice/video calling (WebRTC via a managed SDK) — deferred; not started

## What This Project Demonstrates

- NestJS module architecture with dependency injection, guards, strategies, and interceptors
- JWT auth with separate access/refresh secrets and token strategies
- WebSocket real-time communication (Socket.io) with per-connection JWT authentication and an in-memory presence map
- Shared business logic between REST and WebSocket entry points — no duplicated persistence code
- Push notification fallback logic driven by real-time presence state
- Prisma 7's driver-adapter architecture, including the environment-specific debugging it required (quote handling in `--env-file`, `dist/` vs `src/` path resolution)
- Production hardening: global exception handling, rate limiting, environment validation, structured logging
- Multi-stage Docker builds and a working local-container parity workflow
- CI/CD with a real ephemeral database service, and cloud deployment with environment-variable-based secret injection