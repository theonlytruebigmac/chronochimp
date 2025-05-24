#!/bin/bash
# This script fixes Next.js route handlers for Next.js 15.3.2 compatibility

echo "Fixing Next.js 15.3.2 route handlers..."
echo "========================================"

# Find all route files
ROUTE_FILES=$(find /home/fraziersystems/appdata/chronochimp/src/app/api -name "route.ts")

# Loop through each route file
for file in $ROUTE_FILES; do
  echo "Processing $file"
  
  # Create backup
  cp "$file" "${file}.bak"
  
  # Extract the parameter name from the path if it's a dynamic route
  dir_name=$(dirname "$file")
  param_name=""
  if [[ "$dir_name" =~ \[([^\]]*)\] ]]; then
    param_name="${BASH_REMATCH[1]}"
    echo "  - Dynamic route parameter: $param_name"
    
    # Replace RouteContext with RouteParams
    sed -i "s/type RouteContext\s*=\s*{/type RouteParams = {/g" "$file"
    sed -i "s/interface Params\s*{/type RouteParams = {/g" "$file"
    sed -i "s/type Params\s*=\s*{/type RouteParams = {/g" "$file"
    
    # Add RouteParams type if it doesn't exist
    if ! grep -q "type RouteParams" "$file"; then
      param_type="type RouteParams = {\n  $param_name: string;\n};\n"
      sed -i "0,/^export/s/^export/$(echo -e "$param_type")\nexport/" "$file"
    fi
    
    # Fix function signatures
    sed -i "s/export async function GET([^,]*,\s*context:[^)]*)/export async function GET(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function POST([^,]*,\s*context:[^)]*)/export async function POST(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function PUT([^,]*,\s*context:[^)]*)/export async function PUT(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function DELETE([^,]*,\s*context:[^)]*)/export async function DELETE(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function PATCH([^,]*,\s*context:[^)]*)/export async function PATCH(\1, { params }: { params: RouteParams })/g" "$file"
    
    # Fix old Params interface usage
    sed -i "s/export async function GET([^,]*,\s*{\s*params\s*}:\s*Params)/export async function GET(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function POST([^,]*,\s*{\s*params\s*}:\s*Params)/export async function POST(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function PUT([^,]*,\s*{\s*params\s*}:\s*Params)/export async function PUT(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function DELETE([^,]*,\s*{\s*params\s*}:\s*Params)/export async function DELETE(\1, { params }: { params: RouteParams })/g" "$file"
    sed -i "s/export async function PATCH([^,]*,\s*{\s*params\s*}:\s*Params)/export async function PATCH(\1, { params }: { params: RouteParams })/g" "$file"
    
    # Fix parameter extraction
    sed -i "s/const\s*routeParams\s*=\s*await\s*context\.params;/\/\/ Parameter is now directly available in params/g" "$file"
    sed -i "s/const\s*{\s*$param_name\s*}\s*=\s*context\.params;/const { $param_name } = params;/g" "$file"
    sed -i "s/const\s*$param_name\s*=\s*routeParams\.$param_name;/const $param_name = params.$param_name;/g" "$file"
  fi
done

echo "Route handlers fixed for Next.js 15.3.2 compatibility"
echo "Please manually verify the changes and test the application"
