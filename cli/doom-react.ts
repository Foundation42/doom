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
import { createTools, getSystemMessage, loadEnvFromDir } from './utils/tools.js';
import { runChatWithTools } from '../src/chatrunner';
import { Message } from '../src/types';
import { DOOM_LOGO } from './utils/constants.js';

// Debug raw input - disabled
// process.stdin.on('data', (data) => {
//   console.error('Raw stdin data:', data, 'Chars:', JSON.stringify(data.toString()));
// });

// Current version
const VERSION = '1.0.0';

/**
 * Main CLI function
 */
async function main() {
  // Parse arguments - keep original args for flag checks later
  const rawArgs = process.argv.slice(2);
  const args = [...rawArgs];
  
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.red(DOOM_LOGO));
    console.log(`The AI agent that *doesn't* ruin everything.

Usage:
  doom [options] [command]    Run a command or start interactive mode

Options:
  --help, -h                  Show this help message
  --version, -v               Show version information
  --parallel                  Enable parallel execution
  --notool                    Disable tool call visualization (in interactive mode)
  --showtool                  Enable tool call visualization (in batch mode)
  --quiet                     Hide API key detection messages (default in batch mode)
  --verbose                   Show verbose output in batch mode
  
Commands:
  (none)                      Start interactive REPL
  "your command here"         Run a single command and exit

Examples:
  doom                        Start interactive REPL
  doom "What's the weather in Tokyo?"
  doom --parallel "Compare weather in London and New York"
  
For more details visit: https://github.com/Foundation42/doom`);
    process.exit(0);
  }

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    console.log(chalk.red(DOOM_LOGO));
    console.log("DOOM CLI Version: " + VERSION);
    process.exit(0);
  }

  // Extract command and flags
  let command = null;
  let parallelExecution = false;
  let showToolCalls = true;
  let quietMode = false;

  // Check for parallel flag
  if (args.includes('--parallel')) {
    parallelExecution = true;
    // Remove the parallel flag from args for command processing
    const parallelIndex = args.indexOf('--parallel');
    args.splice(parallelIndex, 1);
  }
  
  // Check for notool flag (for interactive mode)
  if (args.includes('--notool')) {
    showToolCalls = false;
    // Remove the notool flag from args for command processing
    const notoolIndex = args.indexOf('--notool');
    args.splice(notoolIndex, 1);
  }
  
  // Check for showtool flag (for batch mode)
  if (args.includes('--showtool')) {
    // Remove the showtool flag from args for command processing
    const showtoolIndex = args.indexOf('--showtool');
    args.splice(showtoolIndex, 1);
  }
  
  // Check for quiet flag
  if (args.includes('--quiet')) {
    quietMode = true;
    // Remove the quiet flag from args for command processing
    const quietIndex = args.indexOf('--quiet');
    args.splice(quietIndex, 1);
  }
  
  // Check for verbose flag (opposite of quiet, used for batch mode)
  if (args.includes('--verbose')) {
    // Remove the verbose flag from args for command processing
    const verboseIndex = args.indexOf('--verbose');
    args.splice(verboseIndex, 1);
  }

  // Treat all remaining args as the command
  if (args.length > 0) {
    command = args.join(' ');
  }

  // Now run either single command or interactive REPL
  if (command) {
    // In single command mode:
    // - quietMode is true by default unless explicitly disabled with --verbose
    // - showToolCalls is false by default unless explicitly enabled with --showtool
    // Use rawArgs to check for flags, as we've removed them from args
    const batchQuietMode = rawArgs.includes('--verbose') ? false : true;
    const batchShowTools = rawArgs.includes('--showtool') ? true : false;
    
    await runSingleCommand(command, parallelExecution, batchShowTools, batchQuietMode);
  } else {
    // Load environment variables from ~/.env
    loadEnvFromDir(quietMode);
    
    // Start the React app with settings
    await runApp({
      parallel: parallelExecution,
      showTools: showToolCalls
    });
  }
}

/**
 * Run a single command and exit
 */
async function runSingleCommand(command: string, useParallel: boolean = false, showToolCalls: boolean = false, quietMode: boolean = true) {
  // Show less information in single command mode (now quiet by default)
  if (!quietMode) {
    console.log(chalk.gray('Running single command mode...'));
    console.log(chalk.gray('Checking for API keys...'));
  }
  
  // Always load the keys, but only print in verbose mode
  loadEnvFromDir(quietMode);
  
  // Set up tools
  const { allTools } = createTools();
  
  // Initialize with system message
  const messages: Message[] = [
    {
      role: 'system',
      content: getSystemMessage()
    },
    {
      role: 'user',
      content: command
    }
  ];

  try {
    if (!quietMode) {
      console.log(`${chalk.redBright.bold('Command:')} ${command}`);
      console.log(`${chalk.yellow('Thinking...')} ${chalk.gray('(DOOM does not ruin things while thinking)')}`);
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    // Create a logger for the REPL
    const replLogger = {
      debug: (message: string, ...args: any[]) => {
        // Skip most debug messages to reduce noise
      },
      info: (message: string, ...args: any[]) => {
        // We now handle this with our tool execution handler
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`${chalk.yellow('⚠️ ')} ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`${chalk.red('❌ ')} ${message}`, ...args);
      }
    };
    
    // Create a tool visualization handler
    const handleToolExecution = (event: any) => {
      const { toolName, args, result, executionTime, error, isSubtask, parentToolName } = event;
      
      // Format arguments for display
      const argsStr = Object.entries(args || {})
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      
      // Format the tool call based on whether it's a subtask and if it succeeded
      if (error) {
        if (isSubtask) {
          console.log(`${chalk.red('⛔')} ${chalk.red.bold(`SubTask(${toolName})`)}: ${argsStr} - Error: ${error}`);
        } else {
          console.log(`${chalk.red('⛔')} ${chalk.red.bold(`Call(${toolName})`)}: ${argsStr} - Error: ${error}`);
        }
      } else {
        // Format the output for display (truncate if too long)
        const displayResult = result && result.length > 60 
          ? result.substring(0, 57) + '...' 
          : result;
        
        if (isSubtask) {
          console.log(`${chalk.magenta('🔄')} ${chalk.magenta.bold(`SubTask(${toolName})`)}: ${argsStr}`); 
          if (displayResult) {
            console.log(`${chalk.gray('   ↪')} ${chalk.gray(displayResult)} ${chalk.gray(`(${executionTime}ms)`)}`);
          }
        } else {
          console.log(`${chalk.cyan('🛠️')} ${chalk.cyan.bold(`Call(${toolName})`)}: ${argsStr}`);
          if (displayResult) {
            console.log(`${chalk.gray('   ↪')} ${chalk.gray(displayResult)} ${chalk.gray(`(${executionTime}ms)`)}`);
          }
        }
      }
    };
    
    // Run chat with tools
    const response = await runChatWithTools(messages, allTools, {
      signal: controller.signal,
      temperature: 0.7,
      logger: replLogger,
      timeoutMs: 55000,
      maxRetries: 2,
      parallel: useParallel,
      onToolExecution: showToolCalls ? handleToolExecution : undefined,
      showToolCalls: showToolCalls // This needs to be true to emit tool execution events
    });

    clearTimeout(timeoutId);

    // Print response with NO prefix in batch mode
    console.log(response);
    return 0;
  } catch (error) {
    console.error(`${chalk.red('❌ Error:')} ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.message === 'Aborted') {
      console.log(chalk.yellow('⏱️ Request was aborted due to timeout.'));
    }
    return 1;
  }
}

// Start the CLI
main().catch(error => {
  console.error(chalk.red(`\nFatal error: ${error}`));
  process.exit(1);
});