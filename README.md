# ChatRunner

A TypeScript library for running chat sessions with LLM tool-calling models, featuring support for automatic subtasks, parallel execution, and a rich set of built-in tools.

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

# Run a single command and exit
npm run run "What's the weather in Tokyo?"

# Run with parallel tool execution 
npm run run "Compare the weather in Tokyo, London and New York" -- --parallel

# Run the subtasks example
npm run subtasks

# Run the parallel execution benchmark
npm run parallel

# Explore the standard tools library (requires OpenAI API key)
npm run tools

# Run basic tools demo locally (no API key needed)
npm run tools:local

# Run advanced tools demo locally (no API key needed)
npm run tools:advanced

# Run advanced AI tools demo (requires OpenAI API key)
npm run tools:ai
```

### API Key Configuration

The examples will check for API keys in the following order:

1. Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, etc.
2. Home directory file: `~/.env` (format: `OPENAI_API_KEY=sk-...`, one per line)
3. Manual input: If no key is found, some examples will prompt you to enter one

For the advanced AI tools demo, at least the OpenAI API key is required. Additional provider keys are optional but enable the multi-provider comparison features.

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

## Standard Tools Library

ChatRunner includes a standard library of reusable tools that you can include in your projects:

```typescript
import { createStandardTools } from 'chatrunner';

// Get the entire standard tool library
const allTools = createStandardTools();

// Or import specific tool categories
import { 
  createHttpTools, 
  createDataTools, 
  createUtilityTools 
} from 'chatrunner/tools';

const httpTools = createHttpTools();
const dataTools = createDataTools();
const utilityTools = createUtilityTools();

// Run with the tools
const result = await runChatWithTools(messages, allTools);
```

### Available Tool Categories

1. **HTTP Tools**
   - `fetchUrl`: Fetches content from a URL with support for various HTTP methods
   - `searchWeb`: Simulates web search and returns relevant results
   - `extractData`: Extracts structured data from HTML or text content

2. **Data Tools**
   - `parseJson`: Validates and formats JSON data
   - `processCSV`: Handles CSV parsing, transformation, and conversion
   - `filterData`: Filters, sorts, and aggregates data
   - `generateChart`: Creates data visualizations (simulated)

3. **Utility Tools**
   - `calculator`: Performs mathematical calculations and unit conversions
   - `dateTime`: Handles date formatting, calculations, and manipulations
   - `translate`: Simulates language translation
   - `stringUtils`: Provides string manipulation operations
   - `cryptoHash`: Performs hashing, encoding, and generation operations

4. **File Tools**
   - `readFile`: Reads content from files with encoding and limit options
   - `writeFile`: Writes or appends content to files
   - `listFiles`: Lists files in directories with filtering options
   - `fileInfo`: Gets detailed information about files and directories
   - `searchFiles`: Searches file contents for patterns and text

5. **AI Tools**
   - `summarizeText`: Creates concise summaries of longer text
   - `analyzeSentiment`: Determines sentiment and emotion in text
   - `extractKeywords`: Extracts key topics and terms from text
   - `classifyText`: Categorizes text into topics or intents
   - `translateText`: AI-powered text translation (enhanced version)

6. **System Tools**
   - `systemInfo`: Provides OS, CPU, memory, and disk information
   - `processInfo`: Shows details of running processes
   - `environment`: Works with environment variables
   - `networkInfo`: Shows network interfaces and connectivity
   - `executeCommand`: Runs safe system commands with security limits

7. **LLM Tools** (requires API keys)
   - `multiProviderCompletion`: Sends prompts to different LLM providers (OpenAI, Anthropic, Google, etc.)
   - `adaptiveCompletion`: Automatically selects appropriate models based on task types
   - `transformText`: Specialized text transformations using task-specific models
   - `compareLLMResponses`: Compares responses from multiple LLM providers for the same prompt
   - `chainOfThought`: Step-by-step reasoning for complex problem solving

8. **TTS Tools** (requires OpenAI API key)
   - `speakText`: Basic text-to-speech with voice selection
   - `narrateContent`: Specialized narration styles for different content types
   - `expressiveSpeech`: Character and emotion-based speech generation

### Helper Utilities

The tools library also includes useful helper functions:

```typescript
import { safeToolExecution, delay } from 'chatrunner';

// Safely execute a function with error handling
const result = await safeToolExecution(
  async () => {
    // Your tool logic here
    return { output: "Success!" };
  },
  (error) => `Custom error message: ${error.message}`
);

// Create a delay with abort signal support
await delay(1000, abortSignal);
```

Try the `npm run tools` command to explore the standard library in an interactive demo.

## License

MIT