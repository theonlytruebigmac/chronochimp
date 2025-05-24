#!/bin/bash
set -e

# Create data directory if it doesn't exist
mkdir -p /app/.data

# Set correct permissions for the data directory
chown -R nextjs:nodejs /app/.data
chmod 777 /app/.data

# Create SQLite database file if it doesn't exist
touch /app/.data/chrono.db
chown nextjs:nodejs /app/.data/chrono.db
chmod 666 /app/.data/chrono.db

# Print status
echo "Database initialization complete:"
ls -la /app/.data
