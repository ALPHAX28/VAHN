# Headroom Context Compression Rules

To optimize token usage and avoid context window bloat, the agent MUST always route all code generation, code review, file reading, and data fetching operations through Headroom.

## Mandatory Rules:
1. **Code/File Reading:** When reading files or codebases (using `view_file`, command line outputs, or search results), if the content is larger than 1,000 tokens, use the `headroom_compress` tool (via the Headroom MCP server) to compress the content before reasoning over it. If full details are needed later, use `headroom_retrieve` with the compression hash.
2. **Code Generation & Writing:** Before generating or writing large blocks of code, pass the draft or structure through Headroom to optimize its layout/tokens, and reference headroom performance statistics if relevant.
3. **Code Reviews:** When performing code reviews on pull requests, commits, or files, pass the code changes and review comments through Headroom compression to keep context footprint small.
4. **Tool/Command Outputs:** Any large output from terminal commands or scripts must be processed with Headroom compression first.
5. **Execution of Scripts:** Use the helper script at `.agents/scripts/headroom_helper.py` when running batch operations or offline file compressions.

Never bypass Headroom for any reading, review, or code generation task. Always maintain the Compress-Cache-Retrieve (CCR) pattern.

# Database Schema & Migration Rules

Whenever any database models or schemas (`backend/models.py`) are modified or added:
1. **Create Alembic Migration**: The agent MUST always generate/write a corresponding revision file under `backend/migrations/versions/` with exact `upgrade()` and `downgrade()` statements matching the schema changes.
2. **Execute Migration**: The agent MUST automatically run the Alembic migration command (`python -m alembic upgrade head` or `alembic upgrade head`) to apply changes to the local/production database immediately.
3. **Seed Update**: If the schema change introduces new default attributes, the agent MUST update `backend/seed.py` and run database seeding.

# Mandatory Backend Python Compilation & Zero-Error Rule (`py_compile`)

Whenever generating, editing, refactoring, or modifying ANY backend Python file, module, endpoint, or logic (e.g., `main.py`, `models.py`, `schemas.py`, services, migrations, or scripts):
1. **Immediately verify code with `py_compile`**: The assistant MUST ALWAYS compile every generated or modified backend Python file using `python -m py_compile <file_path>` (or `.\backend\.venv\Scripts\python.exe -m py_compile <file_path>`).
2. **Zero Errors Allowed**: Not a single file is allowed to have any syntax error, indentation issue, undefined token, or compilation failure. Every modified file must compile cleanly with exit code 0.
3. **Verify clean module import**: When modifying `main.py` or foundational services, verify that the module imports cleanly without unhandled runtime exceptions (`python -c "import main"`).
