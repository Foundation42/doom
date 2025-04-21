import * as readline from 'readline-sync';
import { runChatWithTools } from '../src/chatrunner';
import { Message, Tool } from '../src/types';
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

// Define some sample tools
const tools: Tool[] = [
  {
    name: 'getWeather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { 
          type: 'string', 
          description: 'City name or location'
        }
      },
      required: ['location']
    },
    func: async (args: { location: string }) => {
      // In a real app, this would call a weather API
      return `It's currently 72°F and sunny in ${args.location}.`;
    }
  },
  {
    name: 'calculateTip',
    description: 'Calculate tip amount for a bill',
    parameters: {
      type: 'object',
      properties: {
        amount: { 
          type: 'number', 
          description: 'Bill amount in dollars' 
        },
        percentage: { 
          type: 'number', 
          description: 'Tip percentage (15, 18, 20, etc.)' 
        }
      },
      required: ['amount', 'percentage']
    },
    func: async (args: { amount: number, percentage: number }) => {
      const tipAmount = args.amount * (args.percentage / 100);
      const total = args.amount + tipAmount;
      return {
        output: `Tip: $${tipAmount.toFixed(2)}, Total: $${total.toFixed(2)}`
      };
    }
  }
];

async function main() {
  console.log('🤖 ChatRunner REPL');
  console.log('Type your messages below. Type "exit" to quit.\n');
  
  // Initialize with system message
  const messages: Message[] = [
    { 
      role: 'system', 
      content: 'You are a helpful assistant with access to tools. Keep responses brief and focused.' 
    }
  ];
  
  // REPL loop
  while (true) {
    // Get user input
    const userInput = readline.question('\n👤 You: ');
    
    // Check for exit command
    if (userInput.toLowerCase() === 'exit') {
      console.log('👋 Goodbye!');
      break;
    }
    
    // Add user message to history
    messages.push({
      role: 'user',
      content: userInput
    });
    
    try {
      console.log('\n🤔 Assistant is thinking...');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Run chat with tools
      const response = await runChatWithTools(messages, tools, {
        signal: controller.signal,
        temperature: 0.7
      });
      
      clearTimeout(timeoutId);
      
      // Print response
      console.log(`\n🤖 Assistant: ${response}`);
      
      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: response
      });
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message === 'Aborted') {
        console.log('Request was aborted due to timeout.');
      }
    }
  }
}

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  // Try to load from ~/.env
  const loaded = loadEnvFromHomeDir();
  
  // If still not found, prompt user
  if (!loaded) {
    console.log('🔑 OpenAI API key not found in environment or ~/.env');
    const apiKey = readline.question('Enter your OpenAI API key: ', { hideEchoBack: true });
    process.env.OPENAI_API_KEY = apiKey;
  }
}

// Run the REPL
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});