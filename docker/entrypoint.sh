#!/bin/bash
set -e

# Initialize database and set permissions
echo "=== Database Initialization ==="

# Create data directory if it doesn't exist
if [ ! -d "/app/.data" ]; then
    echo "Creating data directory..."
    mkdir -p /app/.data
    echo "✓ Data directory created"
fi

# Create database file if it doesn't exist
if [ ! -f "/app/.data/chrono.db" ]; then
    echo "Creating database file..."
    touch /app/.data/chrono.db
    echo "✓ Database file created"
fi

# Set proper permissions (more restrictive than before)
echo "Setting permissions..."
chown -R nextjs:nodejs /app/.data
chmod 750 /app/.data
chmod 640 /app/.data/chrono.db
echo "✓ File permissions set"

# Verify permissions
echo "Verifying database access..."
if [ -r "/app/.data/chrono.db" ] && [ -w "/app/.data/chrono.db" ]; then
    echo "✓ Database file is readable and writable by application user"
else
    echo "❌ Database file permissions check failed"
    exit 1
fi

# Display status for verification
echo "Current data directory permissions:"
ls -la /app/.data/

# Execute the main container command
echo "=== Starting Application ==="
exec "$@"
