# Mandatory Project Rules

## 1. Database Schema & Alembic Migration Requirement (STRICT RULE)
Whenever modifying, adding, deleting, or altering ANY database schema, SQLAlchemy models, tables, columns, foreign keys, or indexes (e.g., modifying `backend/models.py`), the assistant MUST ALWAYS:
1. **Generate an explicit, version-controlled Alembic migration script** inside `backend/migrations/versions/` (e.g. `alembic revision --autogenerate -m "..."` or writing the numbered `upgrade()` / `downgrade()` script).
2. **Execute the Alembic migration** (`alembic upgrade head`) to upgrade both local and production databases cleanly.
3. **NEVER skip or omit Alembic migrations** under any circumstances for any DB additions, deletions, or column alterations.

## 2. Headroom Context Compression Rules (CCR Pattern)
Always maintain token-efficient CCR patterns and route large file reads through Headroom.

## 3. Mandatory Python Dependency Tracking & Sync Rule with Astral uv (STRICT RULE)
Whenever adding, importing, updating, or deleting ANY third-party Python module or library in the backend (e.g. `boto3`, `redis`, `httpx`, `pillow`, etc.):
1. **Declare in `backend/pyproject.toml`**: Add any newly introduced package (or remove unused ones) under `dependencies` in `backend/pyproject.toml` (or run `uv add <package>` in `backend/`).
2. **Synchronize all lock manifests via `create_pylock.py`**: Run `create_pylock.py` (`.\backend\.venv\Scripts\python.exe create_pylock.py`), which automatically synchronizes `backend/uv.lock`, exports `backend/requirements.txt`, and writes `backend/pylock.toml`.
3. **NEVER leave `pyproject.toml`, `uv.lock`, `requirements.txt`, or `pylock.toml` out of sync** with backend Python imports under any circumstances.

## 4. STRICT PRODUCTION DEPLOYMENT RULE (DO NOT DEPLOY TO PROD) (STRICT RULE)
Under NO circumstances should the assistant push to `main`, merge `dev` into `main`, or trigger a production deployment UNLESS AND UNTIL the user EXPLICITLY commands it (e.g., "deploy to prod", "deploy to production", "merge dev to main").
- All regular development, features, fixes, commits, and pushes MUST be strictly performed on the **`dev`** branch (deploying exclusively to `https://dev.vahnsports.com`).
- The `main` branch is locked for production releases only and requires explicit, verbatim user authorization before any push or merge is executed.

## 5. Mandatory Astral Quality Gate: Ruff, ty, & py_compile Zero-Error Rule (STRICT RULE)
Whenever generating, editing, refactoring, or modifying ANY backend Python file, module, endpoint, or logic (e.g., `main.py`, `models.py`, `schemas.py`, services, migrations, or scripts):
1. **Astral Ruff Linter**: Run `.\backend\.venv\Scripts\ruff.exe check backend` (or within `backend/`). Must pass with exit code 0 and zero lint errors.
2. **Astral ty Type Checker**: Run `.\backend\.venv\Scripts\ty.exe check --python .\backend\.venv` within `backend/`. Must pass with exit code 0 and zero type errors.
3. **Python `py_compile`**: The assistant MUST ALWAYS compile every modified backend Python file using `python -m py_compile <file_path>` (or `.\backend\.venv\Scripts\python.exe -m py_compile <file_path>`). Must exit cleanly with exit code 0.
4. **Verify clean module import**: When modifying `main.py` or foundational services, verify that the module imports cleanly without unhandled runtime exceptions (`python -c "import main"`).
5. **Zero Errors Allowed**: Not a single file is allowed to have any syntax error, indentation issue, undefined token, lint warning, or type violation.

## 6. Mandatory Frontend Quality Gate: TypeScript, Biome, & Build Rule (STRICT RULE)
Whenever generating, editing, refactoring, or modifying ANY frontend TypeScript/TSX file, component, page, layout, style, or configuration in `frontend/`:
1. **TypeScript Quality Gate**: Run `npx tsc --noEmit` in `frontend/`. Must exit with code 0 and zero type errors.
2. **Biome Linter & Formatter**: Run `npm run check:biome` (or `npx biome check .`) in `frontend/`. Must pass with zero unhandled errors.
3. **Next.js Production Build Validation**: Whenever modifying global layouts (`app/layout.tsx`), root components, routing structure, or `next.config.js`, run `npm run build` in `frontend/` to verify that all static and dynamic routes compile and render cleanly in standalone mode.
4. **Zero Errors Allowed**: Not a single frontend file is allowed to have any syntax error, unresolved import, undefined prop, or unhandled React runtime error before pushing to `dev`.

## 7. Frontend UI/UX, Image Optimization, & Toast Standards Rule
1. **Toast Notifications**: ALWAYS use `sonner` (`import { toast } from 'sonner'`) for user feedback (`toast.success(...)`, `toast.error(...)`, `toast.loading(...)`, `toast.promise(...)`). NEVER create one-off `const [toast, setToast] = useState("")` alert blocks in individual pages.
2. **Client-Side Data Fetching & Caching**: Prefer `swr` (`useApi` from `@/lib/swr`) for real-time cart state, profile syncing, or client-side polling to avoid memory leaks and unhandled promise rejections.
3. **Next.js Image Optimization**: ALWAYS use Next.js `<Image />` component with configured AVIF and WebP formats (`formats: ['image/avif', 'image/webp']`). NEVER set `unoptimized: true` without explicit architectural approval.

## 8. Container Security & Docker Hardening Rule (STRICT RULE)
Every container build (backend and frontend) must adhere to unprivileged security and build optimization:
1. **Unprivileged Non-Root Execution**:
   - Backend container MUST run under non-root `vahn:10001` (`USER vahn:vahn`).
   - Frontend container MUST run under non-root `nextjs:1001` (`USER nextjs:nodejs`).
2. **Docker Context Cleanliness**: Both `backend/.dockerignore` and `frontend/.dockerignore` MUST prevent local artifacts (`node_modules/`, `.next/`, `.venv/`, `*.log`, `.env*.local`) from leaking into Docker daemon build contexts.
3. **Build Caching**: Dockerfiles MUST utilize BuildKit cache mounts (`RUN --mount=type=cache,target=...`) for dependency installation stages (`uv sync` / `npm ci`).
4. **Native Container Healthcheck**: Every production container Dockerfile MUST specify a native `HEALTHCHECK` directive (e.g. `curl -f http://localhost:8000/api/health` or `wget -qO- http://localhost:3000/`).

