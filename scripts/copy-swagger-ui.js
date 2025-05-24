const fs = require('fs');
const path = require('path');

console.log('Starting Swagger UI file copy process...');

// Ensure __dirname is properly set
const scriptDir = __dirname || path.dirname(process.argv[1]);
console.log(`Script directory: ${scriptDir}`);

// Get paths with better error handling
const nodeModulesPath = path.resolve(path.join(scriptDir, '..', 'node_modules'));
const swaggerDistPath = path.join(nodeModulesPath, 'swagger-ui-dist');
const publicPath = path.resolve(path.join(scriptDir, '..', 'public'));

console.log(`Swagger dist path: ${swaggerDistPath}`);
console.log(`Public path: ${publicPath}`);

// Check if swagger-ui-dist exists
if (!fs.existsSync(swaggerDistPath)) {
  console.error(`Error: swagger-ui-dist directory not found at ${swaggerDistPath}`);
  console.log('Checking for swagger-ui-dist in node_modules root...');
  
  // Try to find swagger-ui-dist in node_modules
  const alternateSwaggerPath = path.join(process.cwd(), 'node_modules', 'swagger-ui-dist');
  if (fs.existsSync(alternateSwaggerPath)) {
    console.log(`Found swagger-ui-dist at ${alternateSwaggerPath}`);
    swaggerDistPath = alternateSwaggerPath;
  } else {
    console.error('Error: swagger-ui-dist not found. Make sure it is installed.');
    process.exit(1);
  }
}

// List of files to copy
const filesToCopy = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-16x16.png',
  'favicon-32x32.png'
];

// Create directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  console.log(`Creating public directory at ${publicPath}`);
  try {
    fs.mkdirSync(publicPath, { recursive: true });
    console.log('Public directory created successfully');
  } catch (err) {
    console.error(`Error creating public directory: ${err.message}`);
    process.exit(1);
  }
}

// Copy files
let copySuccessCount = 0;
filesToCopy.forEach(file => {
  const srcPath = path.join(swaggerDistPath, file);
  const destPath = path.join(publicPath, file);
  
  if (!fs.existsSync(srcPath)) {
    console.error(`Source file not found: ${srcPath}`);
    return;
  }
  
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to public directory`);
    copySuccessCount++;
  } catch (err) {
    console.error(`Error copying ${file}:`, err);
  }
});

console.log(`Copy process completed. Successfully copied ${copySuccessCount}/${filesToCopy.length} files.`);
