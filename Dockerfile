
# Stage 1: Builder
FROM node:slim AS builder

# Set working directory
WORKDIR /app

# Install system dependencies required for node-gyp and better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Copy entire project
COPY . .

# Debug: Show project structure
RUN tree /app/src/components

# Install dependencies with better error output
RUN NODE_ENV=development npm install --production=false --verbose

# Verify module resolution
RUN node -e "try { require.resolve('@/components/ui/button'); console.log('Module resolution successful!'); } catch(e) { console.error('Module resolution failed:', e); process.exit(1); }"

# Set environment variables for build
ENV NODE_ENV=production

# Build the Next.js application with better error output
RUN npm run build || (echo "Build failed. Checking component existence..." && \
    ls -la /app/src/components/ui/ && \
    echo "Checking module resolution..." && \
    node -e "console.log(require.resolve('@/components/ui/button'))" && \
    exit 1)

# Prune development dependencies (optional, as standalone output is quite lean)
# RUN npm prune --production

# Stage 2: Runner
FROM node:slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# ENV PORT 3000 # Next.js standalone output typically uses server.js which listens on port 3000 by default

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Set the user to run the app (optional, for better security)
# USER node # Ensure the .data directory (or its mount point) is writable by this user if created by Dockerfile

EXPOSE 3000

CMD ["node", "server.js"]
