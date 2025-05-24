#!/bin/bash
# This script updates route.ts files to use the correct type format for Next.js 15.3.2

echo "Starting Next.js 15.3.2 route handler compatibility fix..."

# Define the dynamic parameter directories
DYNAMIC_ROUTE_DIRS=(
  "/home/fraziersystems/appdata/chronochimp/src/app/api/admin/invites/[inviteId]"
  "/home/fraziersystems/appdata/chronochimp/src/app/api/admin/invites/[inviteId]/resend"
  "/home/fraziersystems/appdata/chronochimp/src/app/api/admin/users/[userId]"
  "/home/fraziersystems/appdata/chronochimp/src/app/api/auth/invites/[token]"
  "/home/fraziersystems/appdata/chronochimp/src/app/api/me/api_keys/[apiKeyId]"
  "/home/fraziersystems/appdata/chronochimp/src/app/api/tasks/[taskId]"
)

# Extract parameter names from directory paths
for dir in "${DYNAMIC_ROUTE_DIRS[@]}"; do
  if [[ -f "$dir/route.ts" ]]; then
    echo "Processing $dir/route.ts"
    
    # Extract parameter name from directory path
    PARAM_NAME=$(echo "$dir" | grep -o '\[\([^]]*\)\]' | sed 's/\[\(.*\)\]/\1/')
    
    # Create backup
    cp "$dir/route.ts" "$dir/route.ts.bak"
    
    # Fix interface/type definitions
    sed -i "s/interface Params {/type RouteParams = {/g" "$dir/route.ts"
    sed -i "s/type Params = {/type RouteParams = {/g" "$dir/route.ts"
    sed -i "s/type RouteContext = {/type RouteParams = {/g" "$dir/route.ts"
    
    # Fix function signatures for GET, POST, PUT, DELETE, PATCH
    sed -i "s/export async function GET(request: NextRequest, context: RouteContext)/export async function GET(request: NextRequest, { params }: { params: RouteParams })/g" "$dir/route.ts"
    sed -i "s/export async function POST(request: NextRequest, context: RouteContext)/export async function POST(request: NextRequest, { params }: { params: RouteParams })/g" "$dir/route.ts"
    sed -i "s/export async function PUT(request: NextRequest, context: RouteContext)/export async function PUT(request: NextRequest, { params }: { params: RouteParams })/g" "$dir/route.ts"
    sed -i "s/export async function DELETE(request: NextRequest, context: RouteContext)/export async function DELETE(request: NextRequest, { params }: { params: RouteParams })/g" "$dir/route.ts"
    sed -i "s/export async function PATCH(request: NextRequest, context: RouteContext)/export async function PATCH(request: NextRequest, { params }: { params: RouteParams })/g" "$dir/route.ts"
    
    # Fix { params }: Params format
    sed -i "s/{ params }: Params/{ params }: { params: RouteParams }/g" "$dir/route.ts"
    
    # Fix parameter extraction from context
    sed -i "s/const routeParams = await context.params;/\/\/ Parameter is now directly available in params/g" "$dir/route.ts"
    sed -i "s/const [a-zA-Z]* = routeParams.[a-zA-Z]*;/const $PARAM_NAME = params.$PARAM_NAME;/g" "$dir/route.ts"
    
    echo "Updated $dir/route.ts"
  fi
done

# Additional step to manually fix any remaining context.params references
find /home/fraziersystems/appdata/chronochimp/src/app/api -name "route.ts" -type f -exec sed -i 's/const [a-zA-Z]* = context.params.[a-zA-Z]*;/const paramName = params.paramName; \/\/ Fix this parameter name manually if needed/g' {} \;

echo "Route handlers have been updated to be compatible with Next.js 15.3.2"
echo "NOTE: You may need to manually check some files for correct parameter names"
