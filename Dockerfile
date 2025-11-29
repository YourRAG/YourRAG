# Build Stage
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

# Runtime Stage
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN prisma generate

# Copy backend code
COPY *.py .

# Copy frontend build
COPY --from=frontend-builder /app/web/.next/standalone ./web/standalone
COPY --from=frontend-builder /app/web/.next/static ./web/standalone/.next/static
COPY --from=frontend-builder /app/web/public ./web/standalone/public

# Environment variables
ENV PYTHONPATH=/app
ENV PORT=8000
ENV NODE_ENV=production

# Start script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8000 3000

CMD ["./start.sh"]