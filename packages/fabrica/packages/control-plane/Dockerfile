# Fabrica Control Plane API
# Multi-stage build: build TypeScript, then create slim production image

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and root tsconfig
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/control-plane/package.json ./packages/control-plane/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/control-plane/src ./packages/control-plane/src
COPY packages/control-plane/tsconfig.json ./packages/control-plane/

# Build TypeScript
RUN pnpm -r run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-slim

# Install git, curl (for health check), and Docker CLI (for spawning agent containers)
RUN apt-get update && apt-get install -y git curl ca-certificates gnupg && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/control-plane/package.json ./packages/control-plane/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built output from builder stage
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/control-plane/dist ./packages/control-plane/dist

# Copy config
COPY fabrica.config.example.json ./fabrica.config.json

ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "packages/control-plane/dist/main.js"]
