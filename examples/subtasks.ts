import { runChatWithTools } from '../src/chatrunner';
import { Message, Tool, ToolResult, SubTask } from '../src/types';
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

// Define a set of tools that demonstrate subtasks
const tools: Tool[] = [
  {
    name: 'getUserProfile',
    description: 'Get basic user profile information',
    parameters: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string', 
          description: 'User ID or username'
        }
      },
      required: ['userId']
    },
    func: async (args: { userId: string }): Promise<ToolResult> => {
      console.log(`📊 Getting user profile for ${args.userId}`);
      
      // Return the profile with subtasks to get more detailed information
      return {
        output: `Found user profile for ${args.userId}: name="John Doe", accountType="premium"`,
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
  },
  {
    name: 'getOrderHistory',
    description: 'Get user order history',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or username' },
        limit: { type: 'number', description: 'Maximum number of orders to return' }
      },
      required: ['userId']
    },
    func: async (args: { userId: string, limit?: number }): Promise<ToolResult> => {
      console.log(`🛒 Getting order history for ${args.userId}, limit=${args.limit || 'none'}`);
      
      return {
        output: `Order history for ${args.userId} (last ${args.limit || 5} orders):
- Order #1001: Wireless Headphones ($129.99) - June 12, 2023
- Order #982: Smart Watch ($199.99) - May 3, 2023
- Order #874: USB-C Cable 2-pack ($14.99) - April 17, 2023`,
        subTasks: [
          { 
            toolName: 'getShippingDetails', 
            args: { orderId: '1001' } 
          }
        ]
      };
    }
  },
  {
    name: 'getShippingDetails',
    description: 'Get shipping details for an order',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID' }
      },
      required: ['orderId']
    },
    func: async (args: { orderId: string }): Promise<string> => {
      console.log(`📦 Getting shipping details for order ${args.orderId}`);
      
      return `Shipping details for order #${args.orderId}:
- Status: Delivered
- Carrier: FedEx
- Tracking #: FX92836192752
- Delivered: June 15, 2023 at 2:45 PM`;
    }
  },
  {
    name: 'getRecommendations',
    description: 'Get product recommendations for a user',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or username' }
      },
      required: ['userId']
    },
    func: async (args: { userId: string }): Promise<string> => {
      console.log(`🔍 Getting recommendations for ${args.userId}`);
      
      return `Recommended products for ${args.userId}:
1. Wireless Charging Pad ($34.99)
2. Bluetooth Speaker ($79.99)
3. Phone Case ($19.99)
4. Screen Protector ($9.99)`;
    }
  }
];

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

  console.log('🤖 Subtasks Example');
  console.log('This example demonstrates how tools can spawn subtasks automatically.\n');
  
  // Initialize with system message
  const messages: Message[] = [
    { 
      role: 'system', 
      content: 'You are an AI assistant for an e-commerce platform. You can look up user profiles, order history, and recommendations.' 
    },
    {
      role: 'user',
      content: 'Tell me about user123\'s profile and recent purchases.'
    }
  ];
    
  try {
    console.log('🔄 Running chat with tools and subtasks...\n');
      
    // Run chat with tools (no need for user input in this example)
    const response = await runChatWithTools(messages, tools, {
      temperature: 0.7,
      modelName: 'gpt-4o-mini'
    });
    
    console.log(`\n🤖 Assistant's final response:\n${response}`);
      
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});