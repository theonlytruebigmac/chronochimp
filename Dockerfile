
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
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data \
    && chown -R 1001:1001 /app/.data \
    && chmod 755 /app/.data

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

# Copy and prepare the mock database file for build
COPY src/lib/db-mock.ts ./src/lib/

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_BUILD_SKIP_DB=true
ENV IS_BUILD_ENVIRONMENT=true

# Run build script with database operations skipped
RUN chmod +x scripts/*.sh && \
    npm run build:no-db

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

# Create entrypoint script directly
RUN echo '#!/bin/bash' > /usr/local/bin/entrypoint.sh && \
    echo 'set -e' >> /usr/local/bin/entrypoint.sh && \
    echo '' >> /usr/local/bin/entrypoint.sh && \
    echo '# Initialize database and set permissions' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Initializing database and setting permissions..."' >> /usr/local/bin/entrypoint.sh && \
    echo 'mkdir -p /app/.data || true' >> /usr/local/bin/entrypoint.sh && \
    echo 'touch /app/.data/chrono.db || true' >> /usr/local/bin/entrypoint.sh && \
    echo 'chown -R nextjs:nodejs /app/.data || echo "Warning: Could not set ownership on data directory"' >> /usr/local/bin/entrypoint.sh && \
    echo 'chmod -R 777 /app/.data || echo "Warning: Could not set permissions on data directory"' >> /usr/local/bin/entrypoint.sh && \
    echo 'chmod 666 /app/.data/chrono.db || echo "Warning: Could not set permissions on database file"' >> /usr/local/bin/entrypoint.sh && \
    echo '' >> /usr/local/bin/entrypoint.sh && \
    echo '# Display permissions for verification' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Current data directory permissions:"' >> /usr/local/bin/entrypoint.sh && \
    echo 'ls -la /app/.data/' >> /usr/local/bin/entrypoint.sh && \
    echo '' >> /usr/local/bin/entrypoint.sh && \
    echo '# Execute the main container command' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Starting application..."' >> /usr/local/bin/entrypoint.sh && \
    echo 'exec "$@"' >> /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose the listening port
EXPOSE 3000

# Set entrypoint and default command
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
