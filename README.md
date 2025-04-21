# ChatRunner

A TypeScript library for running chat sessions with OpenAI's tool-calling models with support for automatic subtasks.

## Features

- ✨ Tool calling with OpenAI's API
- 🔄 Streaming responses
- 🧩 Subtasks for automatic task orchestration
- 🔁 Retry logic for transient errors
- ⏱️ Timeout handling
- 🛑 Cancellation via AbortSignal
- 🛠️ Error-resistant JSON parsing

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

The subtasks will be executed in order, and their results will be included in the conversation context. Subtasks can also return their own subtasks, creating a flexible workflow tree.

## Configuration Options

```typescript
const options = {
  modelName: 'gpt-4o-mini',     // OpenAI model to use
  temperature: 0.7,             // Model temperature
  maxRetries: 3,                // Max retries on transient errors
  retryDelayMs: 1000,           // Base delay before retry attempts
  signal: abortController.signal, // AbortSignal for cancellation
  timeoutMs: 30000,             // Timeout in milliseconds
};

const result = await runChatWithTools(messages, tools, options);
```

## License

MIT