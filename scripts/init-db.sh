#!/bin/bash
set -e

echo "=== Database Setup and Diagnostics ==="

# Create data directory if it doesn't exist
echo "Creating data directory if needed..."
mkdir -p /app/.data || { echo "Failed to create data directory"; exit 1; }

# Set correct permissions for the data directory
echo "Setting permissions..."
chmod 777 /app/.data || echo "Warning: Could not set directory permissions"

# Create SQLite database file if it doesn't exist
echo "Ensuring database file exists..."
touch /app/.data/chrono.db || { echo "Failed to create database file"; exit 1; }
chmod 666 /app/.data/chrono.db || echo "Warning: Could not set file permissions"

# In production, ensure the nextjs user owns the files
if [ "$NODE_ENV" = "production" ]; then
  echo "Setting ownership for production environment..."
  chown -R nextjs:nodejs /app/.data || echo "Warning: Could not set ownership"
fi

# Run a diagnostic check
echo "Running diagnostics..."
echo "System information:"
uname -a
id

echo "Directory structure:"
find /app/.data -type f -o -type d | xargs ls -la

echo "File system info for data directory:"
df -h /app/.data

echo "Permissions summary:"
getfacl /app/.data 2>/dev/null || echo "getfacl not available"
ls -la /app/.data

echo "Database initialization complete"
