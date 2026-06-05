# Deployment Guide — Kavana CleanStock

> **Document Type:** Technical Deployment Guide
> **Target:** DevOps, IT Operations
> **Version:** 1.0.0
> **Last Updated:** 2026-06-04

---

## Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│   Mobile PWA    │  │   Dashboard     │  │   API (Express)      │
│   :4000         │  │   :4001         │  │   :3000              │
│   nginx serve   │  │   nginx serve   │  │   Node.js + Prisma   │
└────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘
         │                    │                       │
         └─────────┬──────────┘                       │
                   │  /api/* → proxy                  │
                   ▼                                   ▼
         ┌──────────────────────────────────────────────┐
         │           Internal Docker Network            │
         │              kavana-cleanstock_kavana-net    │
         └──────────────────────────────────────────────┘
                                │
                                ▼
                   ┌──────────────────────┐
                   │  PostgreSQL 16       │
                   │  :5432               │
                   │  kavana_cleanstock   │
                   └──────────────────────┘
```

**Port Map:**

| Service    | Internal | External | Notes          |
|------------|----------|----------|----------------|
| PostgreSQL | 5432     | 5432     | Database       |
| API        | 3000     | 3000     | Express server |
| Dashboard  | 80       | 4001     | Supervisor UI  |
| Mobile PWA | 80       | 4000     | Limpiador UI   |

---

## Prerequisites

- **Docker** v24+ with Docker Compose plugin (v2.20+)
- **Git** (for cloning the repository)
- **Minimum resources:** 2 CPU cores, 4 GB RAM, 10 GB disk

---

## Quick Start (Local Development)

### Opción A — Lanzador automático (Windows)

Ejecuta [`start.bat`](start.bat) haciendo doble clic desde el explorador de archivos. El script:

1. Verifica e inicia el contenedor Docker PostgreSQL si no está corriendo
2. Instala dependencias npm si faltan
3. Ejecuta migraciones Prisma automáticamente
4. Abre 3 ventanas de terminal (API :3000, Dashboard :4001, Mobile :4000)
5. Abre el navegador en `http://localhost:4001`

### Opción B — Manual (cualquier SO)

### 1. Clone and enter the project

```bash
git clone <repository-url> kavana-cleanstock
cd kavana-cleanstock
```

### 2. Start all services

```bash
# Build and start all containers
docker compose up --build -d

# Monitor logs
docker compose logs -f
```

### 3. Verify deployment

```bash
# Health checks
curl http://localhost:3000/health          # API
curl http://localhost:4001/health          # Dashboard
curl http://localhost:4000/                # Mobile PWA

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kavana.com","password":"admin123"}'

# Swagger docs
open http://localhost:3000/api-docs
```

### 4. Access the applications

| Application  | URL                          | Default Credentials                |
|--------------|------------------------------|------------------------------------|
| Dashboard    | http://localhost:4001        | supervisor@kavana.com / SuperKavana2026! |
| Mobile PWA   | http://localhost:4000        | limpiador@kavana.com / LimpKavana2026!  |
| API Docs     | http://localhost:3000/api-docs | —                                |

---

## Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
# Database (change for production!)
DB_PASSWORD=kavana_pass

# JWT (change for production!)
JWT_SECRET=kavana-cleanstock-jwt-secret-prod-2026
JWT_EXPIRES_IN=15m

# Refresh Tokens
REFRESH_TOKEN_EXPIRY_DAYS=30
```

> **IMPORTANT:** For production, generate strong random secrets:
> ```bash
> openssl rand -base64 32  # for JWT_SECRET
> openssl rand -base64 16  # for DB_PASSWORD
> ```

---

## Production Deployment

### Build and run

```bash
# Generate production secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DB_PASSWORD=$(openssl rand -base64 16)

# Build and start
docker compose up --build -d

# Verify
docker compose ps
docker compose logs --tail=50
```

### Update to a new version

```bash
git pull
docker compose up --build -d
# Database migrations run automatically on API startup
```

### Backup and restore

**Backup PostgreSQL database:**

```bash
docker exec kavana-db pg_dump -U kavana kavana_cleanstock > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore:**

```bash
docker exec -i kavana-db psql -U kavana kavana_cleanstock < backup.sql
```

### Stop and clean up

```bash
# Stop services (preserves data)
docker compose down

# Stop services and delete volumes (WARNING: deletes all data)
docker compose down -v
```

---

## Container Details

### API (`Dockerfile.api`)

- **Base image:** `node:20-alpine`
- **Entrypoint:** Custom `start.sh` script that:
  1. Runs `prisma migrate deploy` (applies pending migrations)
  2. Runs `prisma/seed.js` (seeds initial data)
  3. Starts Express server via `node src/server.js`
- **Health check:** `GET /health`
- **Non-root user:** `appuser` (UID 1001)

### Dashboard (`Dockerfile.dashboard` / `dashboard/nginx.conf`)

- **Base image:** `nginx:1.27-alpine` (multi-stage: Vite build → nginx)
- **API proxy:** `/api/*` → `http://api:3000`
- **SPA fallback:** All non-file routes serve `index.html`
- **Caching:** Static assets cached for 1 year, HTML never cached
- **Gzip:** Enabled for text-based assets
- **Non-root user:** `nginx`

### Mobile PWA (`Dockerfile.mobile` / `mobile/nginx.conf`)

- **Base image:** `nginx:1.27-alpine` (multi-stage: Vite build → nginx)
- **API proxy:** `/api/*` → `http://api:3000`
- **Service Worker:** Served with `no-cache` headers, `Service-Worker-Allowed: /`
- **PWA:** Long cache for assets, standalone manifest
- **Gzip:** Enabled for text-based assets
- **Non-root user:** `nginx`

---

## Scaling Considerations

For production with high concurrency:

1. **API horizontal scaling:**
   - Add API replicas: `docker compose up -d --scale api=3`
   - Add a reverse proxy (nginx, Traefik) in front of API instances
   - Use PostgreSQL connection pooling (PgBouncer)

2. **Database:**
   - Consider managed PostgreSQL (RDS, Cloud SQL) for HA
   - Set up regular WAL archiving for point-in-time recovery

3. **Static frontends:**
   - Dashboard and Mobile PWA are pure static files
   - Serve via CDN (Cloudflare, AWS CloudFront) for global low latency

4. **Environment-specific configs:**
   - Override `.env` variables per environment via Docker Compose override files:
     ```bash
     docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
     ```

---

## Troubleshooting

### API fails to start

```bash
# Check startup logs
docker compose logs api

# Common issues:
#   - Database not ready (wait for healthcheck)
#   - Migration fails (check schema compatibility)
#   - Port 3000 already in use (change PORT in .env)

# Manually run migrations
docker compose exec api npx prisma migrate deploy
```

### Frontend shows blank page

```bash
# Check nginx logs
docker compose logs dashboard
docker compose logs mobile

# Check if API is reachable from nginx
docker compose exec dashboard wget -qO- http://api:3000/health
```

### Database connection refused

```bash
# Verify DB is healthy
docker compose ps db

# Check connection from API container
docker compose exec api wget -qO- http://db:5432

# Reset database (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

---

## File Reference

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](docker-compose.yml) | Full-stack orchestration (4 services) |
| [`Dockerfile.api`](Dockerfile.api) | API build: Node.js + Prisma + Express |
| [`Dockerfile.dashboard`](Dockerfile.dashboard) | Dashboard build: Vite → nginx |
| [`Dockerfile.mobile`](Dockerfile.mobile) | Mobile build: Vite → nginx |
| [`dashboard/nginx.conf`](dashboard/nginx.conf) | Dashboard nginx with API proxy |
| [`mobile/nginx.conf`](mobile/nginx.conf) | Mobile nginx with API proxy + SW headers |
| [`start.bat`](start.bat) | **Lanzador de desarrollo local** (Windows) — inicia BD + API + frontends |
| [`.env`](.env) | Environment variables (local dev defaults) |
| [`.dockerignore`](.dockerignore) | Excludes node_modules, logs, docs from Docker context |
