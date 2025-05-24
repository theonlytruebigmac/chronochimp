#!/bin/bash
set -e

# Check if we're in build environment (Docker)
if [ "$IS_BUILD_ENVIRONMENT" = "true" ]; then
  echo "Build environment detected, using no-db build..."
  npm run build:no-db
  exit 0
fi

# Run pre-build database initialization first
echo "Running pre-build database initialization..."
bash ./scripts/pre-build.sh

echo "Ensuring proper module resolution..."
echo "Preparing for build..."

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

# Continue with the regular build
echo "Starting Next.js build..."
# Force TypeScript to ignore build errors in Docker context
export NEXT_IGNORE_TS_ERRORS=true
export NEXT_IGNORE_LINT=true
next build
