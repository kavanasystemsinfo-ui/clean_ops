# Architecture Specification — Kavana CleanOps

> **Document Type:** Technical Architecture Specification
> **Audience:** IT Consultants, Senior Developers, Technical Stakeholders
> **Version:** 5.0.0
> **Swagger API Version:** 4.0.0
> **Last Updated:** 2026-06-05
> **Status:** Implemented — Backend API v1.3 + Mobile PWA v2.0 (Limpiador App) + Dashboard Supervisor v3.0 + Socket.IO Real-time v5.0 + Full Docker Deployment v4.0

---

## 1. Conceptual Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────────────┐          ┌──────────────────────────┐     │
│  │   PWA (Mobile)       │          │   Dashboard (Supervisor) │     │
│  │   Vite + React       │          │   Vite + React + TS      │     │
│  │   Offline-first      │          │   Analytics & CRUD       │     │
│  │   Dev :4000          │          │   Dev :4001              │     │
│  └─────────┬────────────┘          └─────────────┬────────────┘     │
│            │  HTTPS / JWT                         │  HTTPS / JWT    │
│            │  → /api/* → :3000                    │  → /api/* → :3000│
│            │                                      │  → /socket.io/* │
│            │                                      │    → :3000 (WS) │
│            │                                      │  (tiempo real)  │
│            │                                      │  (eventos push) │
│            │                                      │  (sin refresh)  │
└────────────┼──────────────────────────────────────┼─────────────────┘
              │                                      │
              ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                              │
│                                                                     │
│              Express.js REST API (src/server.js)                    │
│              Middleware Chain:                                       │
│                helmet → cors → winston-http →                       │
│                auth(JWT) → zod-validation                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Auth Routes  │  │  API Routes          │  │ Middleware       │  │
│  │ /api/auth/*  │  │  /api/v1/*           │  │ - authenticate   │  │
│  └──────┬───────┘  │  /stock/*            │  │ - authorize      │  │
│         │          │  /asignaciones/*     │  │ - validate (Zod) │  │
│         │          │  /dashboard/*        │  └──────────────────┘  │
│         │          │  /api-docs (Swagger) │                        │
│         │          └──────────────────────┘                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │       Socket.IO Server (src/lib/socket.js)                   │  │
│  │       - Auth JWT en handshake                                │  │
│  │       - Rooms por centro: centro:{id}                        │  │
│  │       - Eventos emitidos:                                    │  │
│  │         • stock:consumed  → room del centro                  │  │
│  │         • stock:restocked → room del centro                  │  │
│  │         • stock:alert     → room del centro                  │  │
│  │       - Reconexión automática + fallback polling             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────┼───────────────────────────────┼──────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                            │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ authController   │  │ stockController  │  │ asignacionCtrl   │  │
│  │ - login          │  │ - consumeStock   │  │ - getActive      │  │
│  │ - register       │  │   → emite        │  │ - list           │  │
│  │ - verifyToken    │  │   stock:consumed │  │ - create         │  │
│  │ - refresh        │  │   (+ alert si    │  │ - update         │  │
│  │ - logout         │  │     stock bajo)  │  │ - getAllUsers    │  │
│  │                  │  │ - restock        │  └──────────────────┘  │
│  │                  │  │   → emite        │                        │
│  │                  │  │   stock:restocked│                        │
│  │                  │  │ - getInventory   │                        │
│  │                  │  │ - getAlerts      │                        │
│  │                  │  │ - getCentros     │                        │
│  │                  │  └───────┬──────────┘                        │
│  │                  │          │ emitStockConsumed()               │
│  │                  │          │ emitStockRestocked()              │
│  │                  │          ▼                                  │
│  │                  │    ┌──────────────┐                         │
│  │                  │    │ Socket.IO    │                         │
│  │                  │    │ (lib/socket) │                         │
│  │                  │    └──────────────┘                         │
│  └──────────────────┘                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   dashboardCtrl                               │ │
│  │                   - consumption (analytics, grouped by center) │ │
│  │                   - alerts (critical + warning separation)    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │           Dashboard Frontend (dashboard/src/)                  │ │
│  │                                                                 │ │
│  │  ┌────────────┐ ┌────────┐ ┌────────────┐ ┌──────────────┐   │ │
│  │  │ Consumption│ │ Alerts │ │Asignaciones│ │ Inventario   │   │ │
│  │  │ Filtros,   │ │Críticas│ │CRUD Table  │ │ Stock +      │   │ │
│  │  │ tabla,     │ │+ Warn, │ │+ Modal     │ │ Restock      │   │ │
│  │  │ CSV export │ │ CSV    │ │Create/Edit │ │ Modal        │   │ │
│  │  │            │ │◄───────│ │            │ │◄─────────────│   │ │
│  │  │            │ │stock:  │ │            │ │stock:consumed│   │ │
│  │  │            │ │alert   │ │            │ │stock:restocked│  │ │
│  │  └────────────┘ └────────┘ └────────────┘ └──────────────┘   │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │   lib/api.ts    — JWT auth + refresh token rotation      │ │ │
│  │  │   lib/socket.ts — Socket.IO client (socket.io-client)    │ │ │
│  │  │   lib/csv.ts    — BOM UTF-8 CSV export utility           │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└───────────┼─────────────────────┼──────────────────────┼────────────┘
             │                     │                      │
             ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                              │
│                                                                     │
│                         Prisma ORM                                  │
│                    @prisma/client (v6.x)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL Database                        │   │
│  │  usuarios │ centros │ productos │ asignaciones_personal      │   │
│  │  inventario_centros │ registro_movimientos │ refresh_tokens  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│               Docker Compose — 4 Services (kavana-net bridge)       │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  PostgreSQL  │    │  API         │    │  Dashboard           │  │
│  │  :5432       │◄──►│  :3000       │◄───│  nginx :80 → :4001   │  │
│  │  pgdata vol  │    │  Express     │    │  /api/* → api:3000   │  │
│  └──────────────┘    │  Prisma      │    │  /socket.io/* →      │  │
│                      │  + Socket.IO │    │  api:3000 (WS)       │  │
│                      └──────┬───────┘    └──────────────────────┘  │
│                              │                                      │
│                      ┌──────▼───────┐                              │
│                      │  Mobile PWA  │                              │
│                      │  nginx :80   │                              │
│                      │  → :4000     │                              │
│                      │  /api/* →    │                              │
│                      │  api:3000    │                              │
│                      └──────────────┘                              │
│                                                                     │
│  Volumes: pgdata (persistent)                                       │
│  Networks: kavana-net (internal bridge)                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Container Images

| Image | Size | Base | Notes |
|-------|------|------|-------|
| `kavana-cleanops-api` | 1.09 GB | `node:20-alpine` | Prisma + Express + Socket.IO, multi-stage |
| `kavana-cleanops-dashboard` | 74.4 MB | `nginx:1.27-alpine` | Vite build → nginx static serve + WebSocket proxy |
| `kavana-cleanops-mobile` | 74.7 MB | `nginx:1.27-alpine` | Vite build → nginx + PWA SW |
| `postgres:16-alpine` | 396 MB | `alpine:3.21` | PostgreSQL 16 Alpine |

### Key Files

| File | Purpose |
|------|---------|
| [`Dockerfile.api`](Dockerfile.api) | API multi-stage build with auto-migrate + seed script |
| [`Dockerfile.dashboard`](Dockerfile.dashboard) | Dashboard Vite build → nginx production serve |
| [`Dockerfile.mobile`](Dockerfile.mobile) | Mobile PWA Vite build → nginx with SW support |
| [`dashboard/nginx.conf`](dashboard/nginx.conf) | nginx config: SPA fallback, API proxy + Socket.IO WebSocket, Gzip, security |
| [`mobile/nginx.conf`](mobile/nginx.conf) | nginx config: SPA fallback, SW headers, API proxy |
| [`start.bat`](start.bat) | **Windows launcher:** starts Docker + migrates + opens 3 dev servers in terminals |
| [`docker-compose.yml`](docker-compose.yml) | 4-service orchestration with healthchecks |
| [`.env.example`](.env.example) | Environment template for production |
| [`docs/deployment.md`](docs/deployment.md) | Full deployment guide |
