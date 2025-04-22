/**
 * Enhanced REPL for ChatRunner with standard library tools and improved UI
 */
import * as readline from 'readline-sync';
import { 
  runChatWithTools, 
  createConsoleLogger,
  createStandardTools
} from '../src';
import { Message, Tool } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// Use CommonJS version of chalk (v4) for compatibility
import chalk from 'chalk';

// Banner for the REPL
const banner = `
${chalk.blue.bold('╔═══════════════════════════════════════════════════════╗')}
${chalk.blue.bold('║')}                 ${chalk.blueBright.bold('💬 ChatRunner Enhanced REPL')}             ${chalk.blue.bold('║')}
${chalk.blue.bold('╚═══════════════════════════════════════════════════════╝')}
`;

// Load environment variables from ~/.env file
function loadEnvFromDir() {
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
            console.log(chalk.green(`🔑 Found ${keyName} in ~/.env`));
          }
        }
      }
      return keysFound > 0;
    }
    return false;
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Error reading ~/.env file: ${error}`));
    return false;
  }
}

// Create a custom logger for the REPL
const replLogger = createConsoleLogger('', 'info');

/**
 * Lists all available tools categories and their tools
 */
function listTools(tools: Tool[]) {
  // Group tools by category
  const categories: Record<string, Tool[]> = {};

  // Extract category from tool name (category is everything before the first uppercase letter)
  tools.forEach(tool => {
    let category = '';
    
    // For our standard tools, they're typically camelCase with the category as prefix
    // E.g., httpFetchTool, fileReadTool, etc.
    if (tool.name.match(/^[a-z]+[A-Z]/)) {
      category = tool.name.match(/^([a-z]+)[A-Z]/)?.[1] || 'other';
    } else {
      category = 'custom';
    }
    
    // Correct some special categories
    if (['analyze', 'extract', 'classify', 'summarize', 'translate'].some(prefix => 
      tool.name.startsWith(prefix))) {
      category = 'ai';
    }
    if (['speak', 'narrate', 'expressive'].some(prefix => tool.name.startsWith(prefix))) {
      category = 'tts';
    }
    if (['chain', 'multi', 'adaptive', 'transform', 'compare'].some(prefix => 
      tool.name.startsWith(prefix))) {
      category = 'llm';
    }
    
    // Always capitalize first letter
    category = category.charAt(0).toUpperCase() + category.slice(1);
    
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(tool);
  });
  
  console.log(chalk.cyan.bold('\n📚 Available Tool Categories:\n'));
  
  // Print categories and tools
  Object.entries(categories).forEach(([category, categoryTools]) => {
    console.log(chalk.green.bold(`  ${category} (${categoryTools.length}):`));
    categoryTools.forEach(tool => {
      console.log(`    ${chalk.yellow(tool.name)} - ${tool.description}`);
    });
    console.log('');
  });
  
  console.log(chalk.gray('Type "help" for usage instructions or "exit" to quit.\n'));
}

/**
 * Displays help information for the REPL
 */
function showHelp() {
  console.log(chalk.cyan.bold('\n🔍 REPL Commands:'));
  console.log(`
  ${chalk.yellow('exit')}          - Exit the REPL
  ${chalk.yellow('help')}          - Show this help message
  ${chalk.yellow('tools')}         - List all available tools
  ${chalk.yellow('clear')}         - Clear the conversation history
  ${chalk.yellow('parallel on')}   - Enable parallel tool execution
  ${chalk.yellow('parallel off')}  - Disable parallel tool execution
  
${chalk.cyan.bold('💡 Tips:')}
  - Ask questions naturally and the assistant will use tools appropriately
  - For AI and LLM tools, provide sufficient text to analyze
  - Some tools like TTS and LLM tools require API keys in your environment
  
${chalk.cyan.bold('📋 Examples:')}
  - "What's the weather in Tokyo?"
  - "Calculate a 18% tip on a $45.50 bill"
  - "Summarize this article: [paste text here]"
  - "Translate this to Spanish: Hello, how are you?"
  - "Who are you and what tools can you use?"
  `);
}

async function main() {
  console.log(banner);
  console.log(`${chalk.yellow('Welcome to the enhanced ChatRunner REPL with standard library tools.')}`);
  
  // Initialize with parallel flag
  let parallelExecution = false;
  
  // Set up all available tools (standard + custom)
  const standardTools = createStandardTools();
  
  // Add custom tools with familiar examples
  const customTools: Tool[] = [
    {
      name: 'get_weather',
      description: 'Get current temperature for a given location.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'City e.g. Tokyo'
          },
          country: {
            type: 'string',
            description: 'Country e.g. Japan'
          }
        },
        required: ['city'],
        additionalProperties: false
      },
      func: async (args: { city: string, country?: string }) => {
        const cities: Record<string, {temp: string, condition: string}> = {
          'new york': { temp: '75°F (24°C)', condition: 'sunny' },
          'los angeles': { temp: '80°F (27°C)', condition: 'sunny' },
          'chicago': { temp: '65°F (18°C)', condition: 'cloudy' },
          'london': { temp: '60°F (16°C)', condition: 'rainy' },
          'tokyo': { temp: '70°F (21°C)', condition: 'partly cloudy' },
          'paris': { temp: '68°F (20°C)', condition: 'overcast' },
          'sydney': { temp: '78°F (26°C)', condition: 'sunny' },
          'mumbai': { temp: '85°F (29°C)', condition: 'humid' },
          'cairo': { temp: '90°F (32°C)', condition: 'sunny' },
          'moscow': { temp: '55°F (13°C)', condition: 'cloudy' },
        };
        
        const cityKey = args.city.toLowerCase();
        const cityInfo = cities[cityKey] || { temp: '72°F (22°C)', condition: 'fair' };
        
        return {
          output: `It's currently ${cityInfo.temp} and ${cityInfo.condition} in ${args.city}${args.country ? ', ' + args.country : ''}.`,
        };
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
        required: ['amount', 'percentage'],
        additionalProperties: false
      },
      func: async (args: { amount: number, percentage: number }) => {
        const tipAmount = args.amount * (args.percentage / 100);
        const total = args.amount + tipAmount;
        
        return {
          output: `Tip: $${tipAmount.toFixed(2)}, Total: $${total.toFixed(2)}`,
        };
      }
    }
  ];
  
  // Combine all tools
  const allTools = [...standardTools, ...customTools];
  
  // Display tool count
  console.log(chalk.green(`\n🛠️  Loaded ${allTools.length} tools (${standardTools.length} standard + ${customTools.length} custom)`));
  
  // Display command help
  console.log(chalk.gray('\nType "tools" to see available tools, "help" for commands, or "exit" to quit.'));
  
  // Initialize with system message
  let messages: Message[] = [
    {
      role: 'system',
      content: `You are a helpful assistant with access to many advanced tools including file, AI, system, data, http, and utility tools.
You can also use LLM tools for complex reasoning and TTS tools for text-to-speech if the user has API keys.
When appropriate, identify which tool to use and provide all required arguments that match the tool's parameters schema.
Keep responses focused and concise.`
    }
  ];

  // REPL loop
  while (true) {
    // Get user input with styled prompt
    const userInput = readline.question(`\n${chalk.green.bold('You:')} `);
    
    // Check for REPL commands
    if (userInput.toLowerCase() === 'exit') {
      console.log(chalk.blue('👋 Goodbye!'));
      break;
    } else if (userInput.toLowerCase() === 'help') {
      showHelp();
      continue;
    } else if (userInput.toLowerCase() === 'tools') {
      listTools(allTools);
      continue;
    } else if (userInput.toLowerCase() === 'clear') {
      messages = [messages[0]]; // Keep only the system message
      console.log(chalk.yellow('🧹 Conversation history cleared.'));
      continue;
    } else if (userInput.toLowerCase() === 'parallel on') {
      parallelExecution = true;
      console.log(chalk.yellow('🚀 Parallel tool execution enabled.'));
      continue;
    } else if (userInput.toLowerCase() === 'parallel off') {
      parallelExecution = false;
      console.log(chalk.yellow('🔄 Sequential tool execution enabled.'));
      continue;
    }

    // Add user message to history
    messages.push({
      role: 'user',
      content: userInput
    });

    try {
      console.log(`\n${chalk.blue('Assistant:')} ${chalk.gray('Thinking...')}`);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      // Run chat with tools
      const response = await runChatWithTools(messages, allTools, {
        signal: controller.signal,
        temperature: 0.7,
        logger: replLogger,
        timeoutMs: 55000,
        maxRetries: 2,
        parallel: parallelExecution
      });

      clearTimeout(timeoutId);

      // Print response with formatting
      console.log(`\n${chalk.blue.bold('Assistant:')} ${response}`);

      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: response
      });
    } catch (error) {
      console.error(`\n${chalk.red('❌ Error:')} ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message === 'Aborted') {
        console.log(chalk.yellow('⏱️ Request was aborted due to timeout.'));
      }
    }
  }
}

// Check for API keys in .env or environment
console.log(chalk.gray('Checking for API keys...'));
loadEnvFromDir();

// If no OpenAI key, prompt user
if (!process.env.OPENAI_API_KEY) {
  console.log(chalk.yellow('🔑 OpenAI API key not found in environment or ~/.env'));
  console.log(chalk.gray('An API key is required for ChatRunner to function.'));
  const apiKey = readline.question(chalk.cyan('Enter your OpenAI API key: '), { hideEchoBack: true });
  process.env.OPENAI_API_KEY = apiKey;
}

// Run the REPL
main().catch(error => {
  console.error(chalk.red(`\nFatal error: ${error}`));
  process.exit(1);
});