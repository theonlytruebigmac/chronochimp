#!/bin/bash
set -e

# Initialize database and set permissions
echo "=== Database Initialization ==="
mkdir -p /app/.data || true
touch /app/.data/chrono.db || true

# Set very permissive permissions for both the directory and database file
echo "Setting permissions..."
chmod -R 777 /app/.data || echo "Warning: Could not set permissions on data directory"
chmod 666 /app/.data/chrono.db || echo "Warning: Could not set permissions on database file"

# Set ownership
echo "Setting ownership..."
chown -R nextjs:nodejs /app/.data || echo "Warning: Could not set ownership on data directory"

# Display status for verification
echo "Current data directory permissions:"
ls -la /app/.data/

# Execute the main container command
echo "=== Starting Application ==="
exec "$@"
