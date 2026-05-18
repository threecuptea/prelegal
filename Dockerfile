# syntax=docker/dockerfile:1.7

# Stage 1: Build the Next.js static export.
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime serving FastAPI + the exported frontend.
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/ ./backend/

WORKDIR /app/backend
RUN uv sync --no-dev

WORKDIR /app
COPY --from=frontend-builder /app/frontend/out ./frontend/out

EXPOSE 8000

WORKDIR /app/backend
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
