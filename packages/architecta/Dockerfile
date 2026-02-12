FROM node:20-slim

# Install git (needed for git commands)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Create workspace mount point
RUN mkdir /workspace

WORKDIR /workspace

ENTRYPOINT ["node", "/app/dist/index.js", "/workspace"]
