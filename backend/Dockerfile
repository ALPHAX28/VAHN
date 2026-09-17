# ==========================================
# Stage 1: Build & Dependency Resolution (Astral uv)
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install Astral uv binary from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install build dependencies required for compiling C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY pyproject.toml uv.lock ./

# Install production dependencies into /app/.venv using uv frozen lockfile
ENV UV_PROJECT_ENVIRONMENT="/app/.venv"
RUN uv sync --frozen --no-dev --no-install-project

# ==========================================
# Stage 2: Hardened Unprivileged Runtime
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Production environment configurations
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Install minimal runtime libraries only (no compilers/build-tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root unprivileged user and group
RUN groupadd -g 10001 vahn \
    && useradd -u 10001 -g vahn -s /bin/false -m vahn

# Copy virtual environment from builder stage
COPY --from=builder --chown=vahn:vahn /app/.venv /app/.venv

# Copy backend application source code
COPY --chown=vahn:vahn . /app

# Expose FastAPI backend port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Drop privileges to unprivileged user
USER vahn:vahn

# Execute DB wait, migrations, and server startup
CMD ["python", "entrypoint.py"]

