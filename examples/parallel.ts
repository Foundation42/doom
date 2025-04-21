import { runChatWithTools, createConsoleLogger } from '../src';
import { Message, Tool, ToolResult, SubTask, ParallelConfig } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Load API key from ~/.env file if exists
function loadEnvFromHomeDir() {
  try {
    const homedir = os.homedir();
    const envPath = path.join(homedir, '.env');

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');

      for (const line of envLines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        const match = trimmedLine.match(/^(OPENAI_API_KEY)=(.*)$/);
        if (match) {
          // Found the API key
          process.env.OPENAI_API_KEY = match[2].trim();
          console.log('🔑 Found OpenAI API key in ~/.env');
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.warn('⚠️ Error reading ~/.env file:', error);
    return false;
  }
}

// Create a custom logger that shows timing information
const logger = {
  debug: (message: string, ...args: any[]) => {},
  info: (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[${new Date().toISOString()}] ⚠️ ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, ...args);
  }
};

/**
 * API Service tool that simulates variable response times
 */
const createAsyncTool = (name: string, baseDelayMs: number): Tool => ({
  name,
  description: `Get data from ${name} (takes ${baseDelayMs}ms)`,
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'ID to look up' }
    },
    required: ['id'],
    additionalProperties: false
  },
  func: async (args: { id: string }): Promise<ToolResult> => {
    logger.info(`⏱️ ${name} - Starting request for ID: ${args.id}`);
    
    // Simulate network delay with some randomness
    const delayMs = baseDelayMs + Math.floor(Math.random() * 200);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    logger.info(`✅ ${name} - Completed (took ${delayMs}ms)`);
    
    // Return result with nested subtasks
    if (name === 'PrimaryService') {
      return {
        output: `${name} data for ID ${args.id} retrieved successfully`,
        subTasks: [
          {
            toolName: 'SecondaryService1',
            args: { id: `${args.id}_sub1` }
          },
          {
            toolName: 'SecondaryService2',
            args: { id: `${args.id}_sub2` }
          },
          {
            toolName: 'SecondaryService3',
            args: { id: `${args.id}_sub3` }
          }
        ]
      };
    } else if (name.startsWith('Secondary')) {
      return {
        output: `${name} data for ID ${args.id} retrieved successfully`,
        subTasks: [
          {
            toolName: 'TertiaryService',
            args: { id: `${args.id}_nested` }
          }
        ]
      };
    } else {
      return {
        output: `${name} data for ID ${args.id} retrieved successfully`
      };
    }
  }
});

// Create a failing tool for error handling demonstration
const createFailingTool = (name: string, failAfterMs: number): Tool => ({
  name,
  description: `A service that fails after ${failAfterMs}ms`,
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'ID to look up' }
    },
    required: ['id'],
    additionalProperties: false
  },
  func: async (args: { id: string }): Promise<ToolResult> => {
    logger.info(`⏱️ ${name} - Starting request for ID: ${args.id} (will fail after ${failAfterMs}ms)`);
    
    // Simulate delay before failure
    await new Promise(resolve => setTimeout(resolve, failAfterMs));
    
    // Simulate failure
    logger.info(`❌ ${name} - Failing as expected`);
    throw new Error(`${name} failed as expected for ID: ${args.id}`);
  }
});

// Create several tools with different response times
const tools: Tool[] = [
  createAsyncTool('PrimaryService', 1000),
  createAsyncTool('SecondaryService1', 1500),
  createAsyncTool('SecondaryService2', 2000),
  createAsyncTool('SecondaryService3', 1000),
  createAsyncTool('TertiaryService', 800),
  createAsyncTool('SlowService', 3000),
  createFailingTool('FailingService', 500),
];

// Function to run a benchmark with a specific configuration
async function runBenchmark(parallel: ParallelConfig | boolean) {
  // Track execution time
  const startTime = Date.now();
  
  // Initialize with system message
  const messages: Message[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant that can work with multiple data services.'
    },
    {
      role: 'user',
      content: 'Retrieve data from the primary service, the slow service, and also try the failing service.'
    }
  ];
  
  try {
    logger.info(`🔄 Starting benchmark with parallel=${JSON.stringify(parallel)}`);
    
    // Run chat with tools
    const response = await runChatWithTools(messages, tools, {
      temperature: 0.7,
      modelName: 'gpt-4o-mini',
      logger,
      parallel
    });
    
    const totalTime = Date.now() - startTime;
    logger.info(`🏁 Benchmark completed in ${totalTime}ms`);
    logger.info(`🤖 Assistant response: ${response}`);
    
    return totalTime;
  } catch (error) {
    logger.error(`Error in benchmark: ${error instanceof Error ? error.message : String(error)}`);
    return -1;
  }
}

async function main() {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    // Try to load from ~/.env
    const loaded = loadEnvFromHomeDir();
    
    // If still not found, error out
    if (!loaded) {
      console.error('🔑 OpenAI API key not found in environment or ~/.env');
      process.exit(1);
    }
  }

  console.log('🤖 ParallelExecution Example');
  console.log('This example demonstrates parallel vs sequential execution of subtasks.\n');
  
  // Run benchmark with sequential execution
  console.log('\n🔄 Running with sequential execution:');
  const sequentialTime = await runBenchmark(false);
  
  // Run benchmark with parallel execution
  console.log('\n🔄 Running with parallel execution:');
  const parallelTime = await runBenchmark({
    enabled: true,
    maxConcurrent: 4,
    includeNested: true,
    continueOnError: true,
    preserveOrder: true
  });
  
  // Show comparison
  if (sequentialTime > 0 && parallelTime > 0) {
    const speedup = (sequentialTime / parallelTime).toFixed(2);
    console.log('\n📊 Results:');
    console.log(`Sequential execution: ${sequentialTime}ms`);
    console.log(`Parallel execution:   ${parallelTime}ms`);
    console.log(`Speedup:              ${speedup}x`);
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});