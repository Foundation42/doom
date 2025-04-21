# ChatRunner

A TypeScript library for running chat sessions with OpenAI's tool-calling models with support for automatic subtasks.

## Features

- ✨ Tool calling with OpenAI's API
- 🔄 Streaming responses
- 🧩 Subtasks for automatic task orchestration
- ⚡ Parallel execution of subtasks
- 🔁 Retry logic for transient errors
- ⏱️ Timeout handling
- 🛑 Cancellation via AbortSignal
- 🛠️ Error-resistant JSON parsing
- 📊 Customizable logging
- 🔍 Parent-child relationship tracking

## Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

## Running the Examples

The repository includes several examples to demonstrate the chatrunner features:

```bash
# Build the project
npm run build

# Run the interactive REPL
npm run repl

# Run the subtasks example
npm run subtasks

# Run the parallel execution benchmark
npm run parallel
```

### API Key Configuration

The examples will check for your OpenAI API key in the following order:

1. Environment variable: `OPENAI_API_KEY`
2. Home directory file: `~/.env` (format: `OPENAI_API_KEY=sk-...`)
3. Manual input: If no key is found, it will prompt you to enter one

## Basic Usage

```typescript
import { runChatWithTools } from 'chatrunner';

// Define a tool
const weatherTool = {
  name: 'getWeather',
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' }
    },
    required: ['location']
  },
  func: async (args) => {
    return `It's sunny in ${args.location}`;
  }
};

// Initial chat history
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What\'s the weather in Paris?' }
];

// Run the chat with tools
const result = await runChatWithTools(messages, [weatherTool]);
console.log(result);
```

## Subtasks

The most powerful feature of ChatRunner is the ability to have tools automatically trigger other tools by returning subtasks:

```typescript
const getUserProfileTool = {
  name: 'getUserProfile',
  description: 'Get user profile information',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID' }
    },
    required: ['userId']
  },
  func: async (args) => {
    // Return both output and subtasks
    return {
      output: `Found user profile for ${args.userId}`,
      subTasks: [
        { 
          toolName: 'getOrderHistory', 
          args: { userId: args.userId, limit: 3 } 
        },
        { 
          toolName: 'getRecommendations', 
          args: { userId: args.userId } 
        }
      ]
    };
  }
};
```

The subtasks will be executed in order (or in parallel if configured), and their results will be included in the conversation context. Subtasks can also return their own subtasks, creating a flexible workflow tree.

### Parallel Execution

You can significantly improve performance by enabling parallel execution of subtasks:

```typescript
// Simple boolean flag for default parallel settings
const result = await runChatWithTools(messages, tools, { parallel: true });

// Or with detailed configuration
const result = await runChatWithTools(messages, tools, {
  parallel: {
    enabled: true,              // Enable parallel execution
    maxConcurrent: 4,           // Maximum concurrent tasks
    includeNested: true,        // Run nested subtasks in parallel too
    maxDepth: 2                 // Maximum depth level for parallelism
  }
});
```

Parallel execution is especially useful when:
1. You have multiple independent subtasks that don't depend on each other
2. Your tools perform network requests or other I/O operations
3. You need to process many subtasks quickly

The `maxConcurrent` setting helps control resource usage by limiting how many tasks run at once.

## Custom Logging

ChatRunner supports custom loggers for better integration with your application's logging system:

```typescript
import { createConsoleLogger } from 'chatrunner';

// Create a custom logger
const myLogger = {
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARNING] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
};

// Or use the built-in helper
const consoleLogger = createConsoleLogger('MyApp:', 'info');

// Pass the logger in options
const result = await runChatWithTools(messages, tools, { logger: myLogger });
```

## Full Configuration Options

```typescript
const options = {
  modelName: 'gpt-4o-mini',     // OpenAI model to use
  temperature: 0.7,             // Model temperature
  maxRetries: 3,                // Max retries on transient errors
  retryDelayMs: 1000,           // Base delay before retry attempts
  signal: abortController.signal, // AbortSignal for cancellation
  timeoutMs: 30000,             // Timeout in milliseconds
  logger: customLogger,         // Custom logger implementation
  parallel: {                   // Parallel execution configuration
    enabled: true,              // Enable parallel execution
    maxConcurrent: 4,           // Maximum concurrent tasks
    includeNested: true,        // Run nested subtasks in parallel too
    maxDepth: 2                 // Maximum depth level for parallelism
  }
};

const result = await runChatWithTools(messages, tools, options);
```

## License

MIT