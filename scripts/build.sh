#!/bin/bash
echo "Ensuring proper module resolution..."
echo "Creating module aliases..."

# Copy UI components to node_modules for direct resolution
mkdir -p node_modules/@/components/ui
cp -r src/components/ui/* node_modules/@/components/ui/

# Continue with the regular build
node scripts/copy-swagger-ui.js
next build
