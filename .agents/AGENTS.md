# Mandatory Project Rules

## 1. Database Schema & Alembic Migration Requirement (STRICT RULE)
Whenever modifying, adding, deleting, or altering ANY database schema, SQLAlchemy models, tables, columns, foreign keys, or indexes (e.g., modifying `backend/models.py`), the assistant MUST ALWAYS:
1. **Generate an explicit, version-controlled Alembic migration script** inside `backend/migrations/versions/` (e.g. `alembic revision --autogenerate -m "..."` or writing the numbered `upgrade()` / `downgrade()` script).
2. **Execute the Alembic migration** (`alembic upgrade head`) to upgrade both local and production databases cleanly.
3. **NEVER skip or omit Alembic migrations** under any circumstances for any DB additions, deletions, or column alterations.

## 2. Headroom Context Compression Rules (CCR Pattern)
Always maintain token-efficient CCR patterns and route large file reads through Headroom.

## 3. Mandatory Python Dependency Tracking & Sync Rule (STRICT RULE)
Whenever adding, importing, updating, or deleting ANY third-party Python module or library in the backend (e.g. `boto3`, `redis`, `httpx`, `pillow`, etc.):
1. **Automatically update `backend/requirements.txt`**: Add any newly introduced third-party package (or remove unused ones) immediately.
2. **Automatically regenerate `backend/pylock.toml`**: Run `create_pylock.py` (`backend\.venv\Scripts\python.exe create_pylock.py`) to keep `pylock.toml` locked and synced.
3. **NEVER leave `requirements.txt` or `pylock.toml` out of sync** with backend Python imports under any circumstances.

## 4. STRICT PRODUCTION DEPLOYMENT RULE (DO NOT DEPLOY TO PROD) (STRICT RULE)
Under NO circumstances should the assistant push to `main`, merge `dev` into `main`, or trigger a production deployment UNLESS AND UNTIL the user EXPLICITLY commands it (e.g., "deploy to prod", "deploy to production", "merge dev to main").
- All regular development, features, fixes, commits, and pushes MUST be strictly performed on the **`dev`** branch (deploying exclusively to `https://dev.vahnsports.com`).
- The `main` branch is locked for production releases only and requires explicit, verbatim user authorization before any push or merge is executed.

## 5. Mandatory Backend Python Compilation & Zero-Error Rule (`py_compile`) (STRICT RULE)
Whenever generating, editing, refactoring, or modifying ANY backend Python file, module, endpoint, or logic (e.g., `main.py`, `models.py`, `schemas.py`, services, migrations, or scripts):
1. **Immediately verify code with `py_compile`**: The assistant MUST ALWAYS compile every generated or modified backend Python file using `python -m py_compile <file_path>` (or `.\backend\.venv\Scripts\python.exe -m py_compile <file_path>`).
2. **Zero Errors Allowed**: Not a single file is allowed to have any syntax error, indentation issue, undefined token, or compilation failure. Every modified file must compile cleanly with exit code 0.
3. **Verify clean module import**: When modifying `main.py` or foundational services, verify that the module imports cleanly without unhandled runtime exceptions (`python -c "import main"`).
