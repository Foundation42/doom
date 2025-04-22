/**
 * DOOM - The AI agent that *doesn't* ruin everything.
 * 
 * Usage:
 *   npm run doom                    - Start interactive DOOM
 *   npm run doom -- --cmd "command" - Run a single command and exit
 *   doom                            - Use CLI binary directly
 *   doom "command"                  - Run command with CLI binary
 */
import * as readline from 'readline-sync';
import { 
  runChatWithTools, 
  createConsoleLogger,
  createStandardTools,
  speakTextTool
} from '../src';
import { Message, Tool } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// Use CommonJS version of chalk (v4) for compatibility
import chalk from 'chalk';

// Banner for the REPL
const banner = `
${chalk.red.bold('╔═══════════════════════════════════════════════════════╗')}
${chalk.red.bold('║')}                 ${chalk.redBright.bold('🔥 DOOM (v1.0) 🔥')}                      ${chalk.red.bold('║')}
${chalk.red.bold('╚═══════════════════════════════════════════════════════╝')}
${chalk.yellow('The AI agent that *doesn\'t* ruin everything.')}
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
 * Parse command line arguments
 * @returns Object with parsed command line options
 */
function parseCommandLineArgs() {
  const args: { cmd?: string, parallel?: boolean, help?: boolean, version?: boolean } = {};
  
  // Process command line arguments
  const argv = process.argv.slice(2);
  
  // Check for help and version flags
  if (argv.includes('--help') || argv.includes('-h')) {
    args.help = true;
    return args;
  }
  
  if (argv.includes('--version') || argv.includes('-v')) {
    args.version = true;
    return args;
  }
  
  // Check for parallel flag
  if (argv.includes('--parallel')) {
    args.parallel = true;
    // Remove the parallel flag for command processing
    const parallelIndex = argv.indexOf('--parallel');
    argv.splice(parallelIndex, 1);
  }
  
  // Legacy --cmd flag support
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--cmd' && i + 1 < process.argv.length) {
      args.cmd = process.argv[i + 1];
      i++; // Skip next arg since we consumed it
      return args;
    }
  }
  
  // If there are any arguments left, treat them as the command
  if (argv.length > 0) {
    args.cmd = argv.join(' ');
  }
  
  return args;
}

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
  
  console.log(chalk.gray('Type "/help" for usage instructions or "/exit" to quit.\n'));
}

/**
 * Displays help information for the REPL
 */
function showHelp() {
  console.log(chalk.redBright.bold('\n🔥 DOOM Commands:'));
  console.log(`
  ${chalk.yellow('/exit')}          - Exit DOOM (if you dare)
  ${chalk.yellow('/help')}          - Show this help message
  ${chalk.yellow('/tools')}         - List all available weapons
  ${chalk.yellow('/clear')}         - Clear the conversation history
  ${chalk.yellow('/parallel on')}   - Enable parallel tool execution
  ${chalk.yellow('/parallel off')}  - Disable parallel tool execution
  
${chalk.redBright.bold('💡 Tips:')}
  - Ask questions naturally and DOOM will use weapons appropriately
  - For AI and LLM tools, provide sufficient text to analyze
  - Some tools like TTS and LLM tools require API keys in your environment
  - DOOM never ruins things (that's the whole point)
  
${chalk.redBright.bold('📋 Examples:')}
  - "What's the weather in Tokyo?"
  - "Calculate a 18% tip on a $45.50 bill"
  - "Summarize this article: [paste text here]"
  - "Translate this to Spanish: Hello, how are you?"
  - "Who are you and what weapons do you have?"
  `);
}

/**
 * Create standard and custom tools for the REPL
 * @returns Object with standardTools, customTools and allTools
 */
function createTools() {
  // Set up all available tools (standard + custom)
  const standardTools = createStandardTools();
  
  // Add custom tools with familiar examples
  // Add a customized version of the speakTextTool with a special doom intro
  const doomSpeakTool = {
    ...speakTextTool,
    func: async (args: any) => {
      if (!process.env.OPENAI_API_KEY) {
        return { output: "Error: OpenAI API key required for TTS" };
      }
      // If this is the first time using TTS in this session, play an intro
      if (!(global as any).doomTtsInitialized) {
        await speakTextTool.func({
          text: "DOOM activated. All systems operational.",
          voice: "nova"
        });
        (global as any).doomTtsInitialized = true;
      }
      return speakTextTool.func(args);
    }
  };

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
  const allTools = [...standardTools, ...customTools, doomSpeakTool];
  
  return {
    standardTools,
    customTools,
    allTools
  };
}

/**
 * Get default system message for the assistant
 */
function getSystemMessage(): string {
  return `You are DOOM - The AI agent that *doesn't* ruin everything.
You have access to many advanced tools including file, AI, system, data, http, and utility tools.
You can also use LLM tools for complex reasoning and TTS tools for text-to-speech if the user has API keys.
When appropriate, identify which tool to use and provide all required arguments that match the tool's parameters schema.
Keep responses focused and concise.`;
}

/**
 * Run the interactive REPL
 */
async function main() {
  console.log(banner);
  console.log(`${chalk.yellow('Welcome to the enhanced ChatRunner REPL with standard library tools.')}`);
  
  // Initialize with parallel flag
  let parallelExecution = false;
  
  // Set up tools
  const { standardTools, customTools, allTools } = createTools();
  
  // Display tool count
  console.log(chalk.redBright(`\n🔥 Armed with ${allTools.length} tools (${standardTools.length} standard + ${customTools.length} custom)`));
  
  // Display command help
  console.log(chalk.gray('\nType "tools" to see available weapons, "help" for commands, or "exit" to quit.'));
  
  // Initialize with system message
  let messages: Message[] = [
    {
      role: 'system',
      content: getSystemMessage()
    }
  ];

  // Command history storage
  const commandHistory: string[] = [];
  let historyIndex = 0;
  
  // Custom readline interface with history support
  function readLineWithHistory(): string {
    // Create a custom prompt with history support
    const input = readline.question(`\n${chalk.redBright.bold('DOOM:')} `, {
      history: commandHistory,
      hideEchoBack: false
    });
    
    // Add non-empty, non-slash-command input to history
    if (input && input.trim() && !input.trim().startsWith('/')) {
      commandHistory.push(input);
    }
    
    return input;
  }
  
  // Display the logo at startup
  console.log(chalk.red(LOGO));
  
  // REPL loop
  while (true) {
    // Get user input with styled prompt and history
    const userInput = readLineWithHistory();
    
    // Check for REPL commands (now with / prefix)
    if (userInput.toLowerCase() === '/exit') {
      console.log(chalk.blue('👋 Goodbye!'));
      break;
    } else if (userInput.toLowerCase() === '/help') {
      showHelp();
      continue;
    } else if (userInput.toLowerCase() === '/tools') {
      listTools(allTools);
      continue;
    } else if (userInput.toLowerCase() === '/clear') {
      messages = [messages[0]]; // Keep only the system message
      console.log(chalk.yellow('🧹 Conversation history cleared.'));
      continue;
    } else if (userInput.toLowerCase() === '/parallel on') {
      parallelExecution = true;
      console.log(chalk.yellow('🚀 Parallel tool execution enabled.'));
      continue;
    } else if (userInput.toLowerCase() === '/parallel off') {
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
      console.log(`\n${chalk.yellow('Thinking...')} ${chalk.gray('(DOOM does not ruin things while thinking)')}`);

      // Run chat with tools without using AbortController/signal directly
      // We'll rely on the timeoutMs parameter instead since it's handled internally
      const response = await runChatWithTools(messages, allTools, {
        temperature: 0.7,
        logger: replLogger,
        timeoutMs: 55000, // Using built-in timeout instead of AbortController
        maxRetries: 2,
        parallel: parallelExecution
      });

      // Print response with formatting
      console.log(`\n${chalk.red.bold('DOOM:')} ${response}`);

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

/**
 * Run a single command and exit
 */
async function runSingleCommand(command: string, useParallel: boolean = false) {
  console.log(chalk.gray('Running single command mode...'));
  
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
    console.log(`${chalk.redBright.bold('Command:')} ${command}`);
    console.log(`${chalk.yellow('Thinking...')} ${chalk.gray('(DOOM does not ruin things while thinking)')}`);

    // Run chat with tools without using AbortController/signal directly
    // We'll rely on the timeoutMs parameter instead since it's handled internally
    const response = await runChatWithTools(messages, allTools, {
      temperature: 0.7,
      logger: replLogger,
      timeoutMs: 55000, // Using built-in timeout instead of AbortController
      maxRetries: 2,
      parallel: useParallel
    });

    // Print response with formatting
    console.log(`${chalk.red.bold('DOOM:')} ${response}`);
    return 0;
  } catch (error) {
    console.error(`${chalk.red('❌ Error:')} ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.message === 'Aborted') {
      console.log(chalk.yellow('⏱️ Request was aborted due to timeout.'));
    }
    return 1;
  }
}

// Current version
const VERSION = '1.0.0';

// DOOM logo (ASCII art for CLI)
const LOGO = `  _____    ____    ____    __  __ 
 |  __ \\  / __ \\  / __ \\  |  \\/  |
 | |  | || |  | || |  | | | \\  / |
 | |  | || |  | || |  | | | |\\/| |
 | |__| || |__| || |__| | | |  | |
 |_____/  \\____/  \\____/  |_|  |_|
                                  
 The AI agent that *doesn't* ruin everything.`;

/**
 * Display the logo
 */
function displayLogo() {
  console.log(chalk.red.bold(LOGO));
}

// Parse command line arguments
const cliArgs = parseCommandLineArgs();

// Handle help flag
if (cliArgs.help) {
  displayLogo();
  console.log(`The AI agent that *doesn't* ruin everything.

Usage:
  doom [options] [command]    Run a command or start interactive mode

Options:
  --help, -h                  Show this help message
  --version, -v               Show version information
  --parallel                  Enable parallel execution
  
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
if (cliArgs.version) {
  displayLogo();
  console.log(`DOOM CLI Version: ${VERSION}`);
  process.exit(0);
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

// Run either single command or interactive REPL
if (cliArgs.cmd) {
  // Single command mode
  runSingleCommand(cliArgs.cmd, cliArgs.parallel).then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error(chalk.red(`\nFatal error: ${error}`));
    process.exit(1);
  });
} else {
  // Interactive REPL mode
  main().catch(error => {
    console.error(chalk.red(`\nFatal error: ${error}`));
    process.exit(1);
  });
}