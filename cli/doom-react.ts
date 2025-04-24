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

// Current version
const VERSION = '1.0.0';

/**
 * Load environment variables from ~/.env file
 */
function loadEnvFromDir(quietMode = false) {
  try {
    const homedir = os.homedir();
    const envPath = path.join(homedir, '.env');

    if (fs.existsSync(envPath)) {
      let keysFound = 0;
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');

      // API keys to look for
      const apiKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_API_KEY',
        'MISTRAL_API_KEY'
      ];

      for (const line of envLines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        // Check for any of our API keys
        for (const keyName of apiKeys) {
          const match = trimmedLine.match(new RegExp(`^(${keyName})=(.*)$`));
          if (match) {
            // Found an API key
            process.env[keyName] = match[2].trim();
            keysFound++;
            if (!quietMode) {
              console.log(chalk.green(`🔑 Found ${keyName} in ~/.env`));
            }
          }
        }
      }
      return keysFound > 0;
    }
    return false;
  } catch (error) {
    if (!quietMode) {
      console.warn(chalk.yellow(`⚠️ Error reading ~/.env file: ${error}`));
    }
    return false;
  }
}

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