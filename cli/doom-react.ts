#!/usr/bin/env node
/**
 * DOOM - The AI agent that *doesn't* ruin everything
 * React-based CLI entry point
 */
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import * as os from 'os';
import { runApp } from './App';
import { loadEnvFromDir } from './utils/tools.js';

// Current version
const VERSION = '1.0.0';

/**
 * Main CLI function
 */
async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.red(`
  _____    ____    ____    __  __ 
 |  __ \\  / __ \\  / __ \\  |  \\/  |
 | |  | || |  | || |  | | | \\  / |
 | |  | || |  | || |  | | | |\\/| |
 | |__| || |__| || |__| | | |  | |
 |_____/  \\____/  \\____/  |_|  |_|
                                  
 The AI agent that *doesn't* ruin everything.
`));
    console.log(`The AI agent that *doesn't* ruin everything.

Usage:
  doom [options]

Options:
  --help, -h                  Show this help message
  --version, -v               Show version information
  
For more details visit: https://github.com/Foundation42/doom`);
    process.exit(0);
  }

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    console.log(chalk.red(`DOOM CLI Version: ${VERSION}`));
    process.exit(0);
  }

  // Load environment variables from ~/.env
  loadEnvFromDir(false);
  
  // Start the React app
  await runApp();
}

// Start the CLI
main().catch(error => {
  console.error(chalk.red(`\nFatal error: ${error}`));
  process.exit(1);
});