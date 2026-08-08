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

