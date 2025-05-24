
# Stage 1: Dependencies
FROM node:18-slim AS deps

WORKDIR /app

# Install system dependencies required for node-gyp and better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    bash \
    dos2unix \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and configs first
COPY package*.json ./

# Clean install dependencies
RUN rm -rf node_modules && \
    npm cache clean --force && \
    npm install --legacy-peer-deps && \
    npm install --save-dev \
    @babel/core@7.23.2 \
    @babel/preset-env@7.23.2 \
    @babel/preset-react@7.22.15 \
    @babel/preset-typescript@7.23.2 \
    babel-plugin-module-resolver@5.0.2 \
    babel-plugin-transform-typescript-metadata@0.3.2 \
    find-babel-config@2.1.2 \
    pkg-up@3.1.0 \
    reselect@4.1.8 \
    json5@2.2.3 \
    find-up@3.0.0 \
    locate-path@3.0.0 \
    p-locate@3.0.0 \
    path-exists@3.0.0

# Copy configuration files
COPY . .

# Fix line endings and make scripts executable
RUN dos2unix scripts/*.js scripts/*.sh && \
    chmod +x scripts/*.sh

# Stage 2: Builder
FROM node:18-slim AS builder

WORKDIR /app

# Copy all files from deps stage
COPY --from=deps /app/ ./

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Run build script (includes module resolution setup)
RUN chmod +x scripts/*.sh && \
    npm run build

# Stage 3: Runner
FROM node:18-slim AS runner

WORKDIR /app

# Install only the necessary system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set runtime environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy built application and required files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/.env* ./

# Create necessary directories with correct permissions
RUN mkdir -p .data .next/cache && \
    chown -R nextjs:nodejs . && \
    chmod -R 755 .next

# Copy and set up entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose the listening port
EXPOSE 3000

# Set entrypoint and default command
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server.js"]
