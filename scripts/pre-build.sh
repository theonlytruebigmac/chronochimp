#!/bin/bash
set -e

echo "Running pre-build database initialization..."

# Create data directory
mkdir -p .data

# Create database file if it doesn't exist
touch .data/chrono.db

# Set permissions
chmod 666 .data/chrono.db
chmod 777 .data

echo "Pre-build setup complete."
