"""
Dockerfile for the Examination Management Portal backend.

Builds the Flask API image (python:3.14-slim) with all backend dependencies
installed from the backend pyproject, then runs the app via the backend
package entry point (`python -m backend.app`).
"""

FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install uv and sync Python dependencies from the backend project definition.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv pip install --system -r pyproject.toml

# Copy the backend application code.
COPY backend/ ./

EXPOSE 5050

# FLASK_RUN_PORT (default 5050) and SQLALCHEMY_DATABASE_URI can be overridden
# through environment variables (see docker-compose.yml).
CMD ["python", "-m", "backend.app"]
