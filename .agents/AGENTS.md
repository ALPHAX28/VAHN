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
