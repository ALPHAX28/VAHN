---
name: python-dependency-sync
description: Automatically sync backend/requirements.txt and backend/pylock.toml whenever a new Python dependency or module is imported or removed in the backend.
---

# Python Dependency Sync Protocol

## Purpose
Enforce automatic synchronization of backend Python dependencies so that any third-party package added, imported, or removed in Python source files is immediately tracked in `backend/requirements.txt` and locked in `backend/pylock.toml`.

## Mandatory Workflow
Whenever creating, modifying, or deleting code in the Python backend (`backend/`):

1. **Detect Dependency Changes**:
   - Inspect newly added `import` statements or third-party package usages (e.g. `boto3`, `redis`, `httpx`, `pillow`, `celery`, etc.).
   - Check if existing dependencies are no longer used.

2. **Update `requirements.txt`**:
   - Append the package name to `backend/requirements.txt` immediately.
   - Remove unused package names if a dependency was completely removed.

3. **Regenerate `pylock.toml`**:
   - Execute `create_pylock.py` to update the PEP 751 lockfile:
     ```powershell
     backend\.venv\Scripts\python.exe create_pylock.py
     ```

4. **Verify & Commit**:
   - Verify that `requirements.txt` and `pylock.toml` match the backend imports.
   - Include dependency manifest changes in commits alongside code edits.
