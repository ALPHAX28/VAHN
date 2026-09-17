---
name: docker-verification
description: >-
  Build, verify, and security-audit hardened unprivileged multi-stage Docker containers
  for both the backend (FastAPI/uv/Python) and frontend (Next.js/Node/Alpine).
  Use whenever modifying Dockerfiles, container entrypoints, docker-compose configs, or container dependencies.
---

# Docker Verification & Hardening Skill

This skill defines the verification procedures for maintaining hardened, unprivileged multi-stage Docker containers across the VAHN platform.

---

## 1. Backend Container Verification (`backend/Dockerfile`)

The backend container is a hardened 2-stage build:
1. **Stage 1 (Builder)**: Uses `ghcr.io/astral-sh/uv:latest` to sync frozen dependencies directly into `/app/.venv` with `--frozen --no-dev`.
2. **Stage 2 (Runner)**: Uses `python:3.11-slim` with minimal runtime libraries only (`libpq5`, `curl`). Compilers (`gcc`, `make`, `uv`) are completely excluded.

### Validation Commands:
```powershell
# 1. Build backend test image:
docker build -t vahn-backend:verify ./backend

# 2. Verify non-root user (MUST be uid=10001(vahn) gid=10001(vahn)):
docker run --rm vahn-backend:verify id

# 3. Verify compilers are omitted from runner stage:
docker run --rm vahn-backend:verify which gcc make uv

# 4. Verify runtime imports:
docker run --rm vahn-backend:verify python -c "import fastapi, uvicorn, sqlalchemy, alembic, razorpay; print('Backend modules OK')"
```

---

## 2. Frontend Container Verification (`frontend/Dockerfile`)

The frontend container is a 3-stage standalone build:
1. **Stage 1 (Deps)**: `node:20-alpine` with BuildKit cache mount: `RUN --mount=type=cache,target=/root/.npm npm ci`.
2. **Stage 2 (Builder)**: Builds Next.js standalone output (`npm run build`).
3. **Stage 3 (Runner)**: Minimal unprivileged runner under system user `nextjs:1001` and group `nodejs:1001`.

### Validation Commands:
```powershell
# 1. Build frontend test image:
docker build -t vahn-frontend:verify ./frontend

# 2. Verify non-root user and group (MUST be uid=1001(nextjs) gid=1001(nodejs)):
docker run --rm vahn-frontend:verify id

# 3. Smoke test HTTP server on non-colliding port (e.g. 3009):
docker run -d --name vahn-fe-test -p 3009:3000 vahn-frontend:verify
curl -I http://localhost:3009/
docker rm -f vahn-fe-test
```

---

## 3. Docker Build Context Cleanliness Audit

Before building or pushing containers, verify `.dockerignore` exists and prevents context bloat:
- `backend/.dockerignore` must exclude: `.venv`, `__pycache__`, `*.pyc`, `.env*.local`.
- `frontend/.dockerignore` must exclude: `node_modules`, `.next`, `tsconfig.tsbuildinfo`, `.env*.local`.

Context transfer time should be <2 seconds (<5MB). If context transfer exceeds 50MB, check `.dockerignore` immediately.

---

## 4. Native Container Healthcheck Standards

All production container images must define a native `HEALTHCHECK`:
- **Backend**:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
      CMD curl -f http://localhost:8000/api/health || exit 1
  ```
- **Frontend**:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
      CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
  ```
