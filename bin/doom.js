#!/usr/bin/env node

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
