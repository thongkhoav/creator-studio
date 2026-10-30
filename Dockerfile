FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Render passes service environment variables as Docker build arguments.
# Only public Supabase configuration belongs in the browser bundle.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY supabase/ ./supabase/
COPY sheet-data.json ./sheet-data.json
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
EXPOSE 10000
CMD ["sh", "-c", "printf '%s' \"window.__CONTENT_CONFIG__={supabaseUrl:'${SUPABASE_URL}',supabasePublishableKey:'${SUPABASE_PUBLISHABLE_KEY}'};\" > frontend/dist/runtime-config.js && exec uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
