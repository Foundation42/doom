/**
 * Demo showcasing the standard tools library
 */
import { runChatWithTools } from '../src/chatrunner';
import { createConsoleLogger } from '../src/index';
import { createStandardTools } from '../src/tools';
import { Tool, Message } from '../src/types';
import * as dotenv from 'dotenv';
import * as readlineSync from 'readline-sync';

// Load environment variables
dotenv.config();

// Create a logger
const logger = createConsoleLogger('Tools Demo: ', 'info');

// Get OpenAI API key from environment or prompt
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || readlineSync.question('Enter your OpenAI API key: ', { hideEchoBack: true });

if (!OPENAI_API_KEY) {
  logger.error('API key is required to run this demo.');
  process.exit(1);
}

// Create a set of standard tools
const tools = createStandardTools();

// Initial system message
const systemMessage = `You are a helpful assistant with access to various tools.
You can help the user by using the appropriate tool for their request.

Available tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Always try to use the most appropriate tool for the user's request.
If multiple tools might be useful, you can use subtasks to chain them together.`;

// Example showcasing different tool categories
async function runToolsDemo() {
  logger.info('Starting the Standard Tools Library demo...');
  logger.info(`Loaded ${tools.length} tools from the standard library.`);
  
  // Initial user message
  const initialUserMessage: Message = { 
    role: 'user', 
    content: 'Hello! I\'d like to explore the standard tools library. What can you do?' 
  };
  
  // Set up initial conversation history
  const initialHistory: Message[] = [
    { role: 'system', content: systemMessage },
    initialUserMessage
  ];
  
  // Run the chat with the standard tools
  const response = await runChatWithTools(
    initialHistory,
    tools,
    {
      signal: AbortSignal.timeout(120000), // 2 minute timeout
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      logger,
      maxRetries: 2,
      timeoutMs: 30000,
      parallel: {
        enabled: true,
        maxConcurrent: 3,
        continueOnError: true
      }
    }
  );
  
  console.log('\nAssistant:', response);
  
  // Simple REPL for interactive demo
  while (true) {
    // Get user input
    const input = readlineSync.question('\nYou: ');
    
    // Check for exit command
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      logger.info('Exiting demo...');
      break;
    }
    
    // Add user message to history
    initialHistory.push({ role: 'assistant', content: response });
    initialHistory.push({ role: 'user', content: input } as Message);
    
    // Call the API again
    const nextResponse = await runChatWithTools(
      initialHistory,
      tools,
      {
        signal: AbortSignal.timeout(120000),
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        logger,
        maxRetries: 2,
        timeoutMs: 30000,
        parallel: {
          enabled: true,
          maxConcurrent: 3,
          continueOnError: true
        }
      }
    );
    
    console.log('\nAssistant:', nextResponse);
  }
}

// Print demo instructions
console.log(`
==================================================
= ChatRunner Standard Tools Library Demo         =
==================================================

This demo showcases the standard tools library.
Try asking for different tool actions, such as:

- HTTP tools:
  "Fetch the content from https://example.com"
  "Extract all dates from a webpage"

- Data tools:
  "Parse this JSON: {'name': 'John', 'age': 30}"
  "Filter this data to only show items with price > 50"

- Utility tools:
  "Calculate 15% of 240"
  "Convert 72°F to Celsius"
  "Generate a secure password"
  "Tell me what date is 45 days from now"

Type 'exit' or 'quit' to end the demo.
`);

// Run the demo
runToolsDemo().catch(error => {
  logger.error('Demo failed:', error);
  process.exit(1);
});