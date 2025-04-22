#!/usr/bin/env node

/**
 * Build script for the DOOM CLI
 * Bundles the CLI into a single executable file
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Paths
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'examples', 'doom.ts');
const outputDir = path.join(rootDir, 'dist', 'cli');
const outputFile = path.join(outputDir, 'doom-cli.js');
const binFile = path.join(rootDir, 'bin', 'doom.js');
const packageJson = require(path.join(rootDir, 'package.json'));

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
  
  // Fix any remaining ChatRunner references in the generated files
  console.log('Fixing any remaining branding references...');
  try {
    // Fix ChatRunner references in the original doom-cli.ts file
    const doomCliContent = fs.readFileSync(path.join(rootDir, 'examples', 'doom-cli.ts'), 'utf8');
    const fixedContent = doomCliContent
      .replace(/Welcome to the enhanced ChatRunner REPL with standard library tools/g, 
               'Welcome to DOOM - The AI agent that *doesn\'t* ruin everything')
      .replace(/An API key is required for ChatRunner to function/g, 
               'An API key is required for DOOM to function');
    fs.writeFileSync(path.join(rootDir, 'examples', 'doom-cli.ts'), fixedContent);
    
    // Also fix in the bundle
    execSync(`sed -i 's/ChatRunner/DOOM/g' ${outputFile}`, {
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

const path = require('path');

// Run the bundled version
const bundledPath = path.resolve(__dirname, '../dist/cli/doom-cli.js');

try {
  // Use spawn to properly handle arguments with spaces
  const { spawnSync } = require('child_process');
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