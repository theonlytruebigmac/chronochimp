#!/bin/bash
# This script updates route.ts files to use the correct type format for Next.js 15.3.2

# Function to process a route file
process_route_file() {
  local file=$1
  echo "Processing $file"
  
  # Create a backup
  cp "$file" "${file}.bak"
  
  # Replace any "interface Params" or "type Params" definitions
  sed -i 's/interface Params {/type RouteParams = {/g' "$file"
  sed -i 's/type Params = {/type RouteParams = {/g' "$file"
  
  # Replace the function signature
  sed -i 's/{ params }: Params/{ params }: { params: RouteParams }/g' "$file"
  sed -i 's/context: RouteContext/{ params }: { params: { taskId: string } }/g' "$file"
  
  # Special case for any remaining instances
  sed -i 's/{ params }: { params: { \([a-zA-Z]*\): string } }/{ params }: { params: { \1: string } }/g' "$file"
  
  echo "Updated $file"
}

# Find all route.ts files and process them
find /home/fraziersystems/appdata/chronochimp/src/app/api -name "route.ts" -type f | while read -r file; do
  process_route_file "$file"
done

echo "All route files have been updated."
