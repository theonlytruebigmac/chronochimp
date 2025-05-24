#!/bin/bash
set -e

# Initialize database and set permissions
/app/scripts/init-db.sh

# Execute the main container command
exec "$@"
