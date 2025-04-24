#!/usr/bin/env node

/**
 * Build script for the DOOM CLI
 * Bundles the CLI into a single executable file
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'cli', 'doom.ts');
const outputDir = path.join(rootDir, 'dist', 'cli');
const outputFile = path.join(outputDir, 'doom-cli.js');
const binFile = path.join(rootDir, 'bin', 'doom.js');

// Read package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Make sure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build the CLI using esbuild directly from doom.ts
console.log('Building CLI with esbuild...');
try {
  // Bundle the CLI with bun, externalizing abort-controller
  console.log('Bundling with bun (with externalized Node.js modules)...');
  execSync(`npx bun build ${sourceFile} --target node --outfile ${outputFile} --external abort-controller --external node:*`, {
    stdio: 'inherit', 
    cwd: rootDir
  });
  
  // Fix any remaining branding references in the generated files
  console.log('Fixing any remaining branding references...');
  try {
    // No need to fix branding references as we've consolidated everything
    
    // Also fix in the bundle
    execSync(`sed -i 's/[Cc]hat[Rr]unner/DOOM/g' ${outputFile}`, {
      stdio: 'inherit',
      cwd: rootDir
    });
  } catch (e) {
    console.warn('Warning: Could not fix branding references:', e.message);
  }
  
  console.log('DOOM CLI built successfully!');
  
  // Create the bin script
  const binScript = `#!/usr/bin/env node

/**
 * DOOM Command Line Interface
 * 
 * This is a bundled version of the DOOM CLI that doesn't require ts-node
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run the bundled version
const bundledPath = path.resolve(__dirname, '../dist/cli/doom-cli.js');

try {
  // Use spawn to properly handle arguments with spaces
  const result = spawnSync('node', [bundledPath, ...process.argv.slice(2)], { 
    stdio: 'inherit',
    shell: false
  });
  process.exit(result.status || 0);
} catch (error) {
  console.error('Error running DOOM CLI:', error.message);
  process.exit(error.status || 1);
}
`;

  // Write and make executable
  fs.writeFileSync(binFile, binScript);
  fs.chmodSync(binFile, 0o755); // Make executable
  
  console.log('Binary script updated at', binFile);
  
} catch (error) {
  console.error('Error building CLI:', error);
  process.exit(1);
}