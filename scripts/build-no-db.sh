#!/bin/bash
set -e
# This is the key difference - set the environment variables to skip DB operations
export NEXT_BUILD_SKIP_DB=true
export IS_BUILD_ENVIRONMENT=true

# Start the Next.js build
echo "Starting Next.js build with database operations skipped..."
NEXT_BUILD_SKIP_DB=true IS_BUILD_ENVIRONMENT=true next buildRunning build with database operations skipped..."

# Create necessary directories for module resolution
mkdir -p node_modules/@/components
mkdir -p node_modules/@/lib
mkdir -p node_modules/@/hooks

# Create symlinks for key directories to ensure module resolution works properly
ln -sf $(pwd)/src/components node_modules/@/components || echo "Warning: Could not create symlink for components"
ln -sf $(pwd)/src/lib node_modules/@/lib || echo "Warning: Could not create symlink for lib"
ln -sf $(pwd)/src/hooks node_modules/@/hooks || echo "Warning: Could not create symlink for hooks"

# Process Swagger UI files
echo "Processing Swagger UI files..."
node scripts/copy-swagger-ui.js || echo "Warning: Swagger UI file processing failed, but continuing build"

# This is the key difference - set the environment variables to skip DB operations
export NEXT_BUILD_SKIP_DB=true
export IS_BUILD_ENVIRONMENT=true

# Run the Next.js build
echo "Starting Next.js build with database operations skipped..."
next build
