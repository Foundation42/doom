import { runChatWithTools, createConsoleLogger, validateToolArgs } from '../src';
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

// Create a logger for the subtasks example
const logger = createConsoleLogger('', 'info');

// Define types for our data store
interface UserPreferences {
  categories: string[];
  notifications: boolean;
}

interface User {
  name: string;
  email: string;
  accountType: string;
  memberSince: string;
  preferences: UserPreferences;
}

interface UserStore {
  [key: string]: User;
}

// Define user data store (simulating a database)
const userStore: UserStore = {
  'user123': {
    name: 'John Doe',
    email: 'john.doe@example.com',
    accountType: 'premium',
    memberSince: '2021-03-15',
    preferences: {
      categories: ['electronics', 'home', 'books'],
      notifications: true
    }
  },
  'user456': {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    accountType: 'standard',
    memberSince: '2022-06-01',
    preferences: {
      categories: ['fashion', 'beauty', 'sports'],
      notifications: false
    }
  }
};

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
      required: ['userId'],
      additionalProperties: false
    },
    func: async (args: { userId: string }): Promise<ToolResult> => {
      logger.info(`Getting user profile for ${args.userId}`);
      
      // Validate arguments against schema
      const validation = validateToolArgs(args, tools[0].parameters);
      if (!validation.valid) {
        return {
          output: `Error: Invalid arguments - ${validation.errors?.join(', ')}`
        };
      }
      
      // Fetch user data (with error handling)
      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const user = userStore[args.userId];
        if (!user) {
          return {
            output: `User ${args.userId} not found`
          };
        }
        
        // Return the profile with subtasks to get more detailed information
        return {
          output: `Found user profile for ${args.userId}:
- Name: ${user.name}
- Account type: ${user.accountType}
- Member since: ${user.memberSince}
- Email: ${user.email}`,
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
      } catch (error) {
        logger.error(`Error fetching user profile: ${error}`);
        return {
          output: `Error retrieving user profile: ${error instanceof Error ? error.message : String(error)}`
        };
      }
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
      required: ['userId'],
      additionalProperties: false
    },
    func: async (args: { userId: string, limit?: number }): Promise<ToolResult> => {
      logger.info(`Getting order history for ${args.userId}, limit=${args.limit || 'none'}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // Check if user exists
        if (!userStore[args.userId]) {
          return {
            output: `User ${args.userId} not found`
          };
        }
        
        // Generate some sample orders
        const orders = [
          { id: '1001', date: 'June 12, 2023', item: 'Wireless Headphones', price: 129.99 },
          { id: '982', date: 'May 3, 2023', item: 'Smart Watch', price: 199.99 },
          { id: '874', date: 'April 17, 2023', item: 'USB-C Cable 2-pack', price: 14.99 },
          { id: '763', date: 'March 5, 2023', item: 'Portable Power Bank', price: 49.99 },
          { id: '698', date: 'February 22, 2023', item: 'Bluetooth Speaker', price: 89.99 }
        ];
        
        // Apply limit
        const limit = args.limit || 5;
        const limitedOrders = orders.slice(0, limit);
        
        // Format order history
        const orderHistoryText = limitedOrders.map(
          order => `- Order #${order.id}: ${order.item} ($${order.price}) - ${order.date}`
        ).join('\n');
        
        return {
          output: `Order history for ${args.userId} (last ${limit} orders):\n${orderHistoryText}`,
          subTasks: [
            { 
              toolName: 'getShippingDetails', 
              args: { orderId: '1001' } 
            }
          ]
        };
      } catch (error) {
        logger.error(`Error fetching order history: ${error}`);
        return {
          output: `Error retrieving order history: ${error instanceof Error ? error.message : String(error)}`
        };
      }
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
      required: ['orderId'],
      additionalProperties: false
    },
    func: async (args: { orderId: string }): Promise<ToolResult> => {
      logger.info(`Getting shipping details for order ${args.orderId}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        // Define shipping detail types
        interface DeliveredShipment {
          status: 'Delivered';
          carrier: string;
          tracking: string;
          delivered: string;
        }
        
        interface InTransitShipment {
          status: 'In Transit';
          carrier: string;
          tracking: string;
          estimatedDelivery: string;
        }
        
        type Shipment = DeliveredShipment | InTransitShipment;
        
        interface ShippingDetails {
          [orderId: string]: Shipment;
        }
        
        // Shipping details based on order ID
        const shippingDetails: ShippingDetails = {
          '1001': {
            status: 'Delivered',
            carrier: 'FedEx',
            tracking: 'FX92836192752',
            delivered: 'June 15, 2023 at 2:45 PM'
          },
          '982': {
            status: 'In Transit',
            carrier: 'UPS',
            tracking: 'UPS1Z4572894572',
            estimatedDelivery: 'May 7, 2023'
          },
          '874': {
            status: 'Delivered',
            carrier: 'USPS',
            tracking: 'USPS9405503699300142783954',
            delivered: 'April 21, 2023 at 11:20 AM'
          }
        };
        
        const details = shippingDetails[args.orderId];
        
        if (!details) {
          return {
            output: `Shipping details for order #${args.orderId} not found`
          };
        }
        
        if (details.status === 'Delivered') {
          return {
            output: `Shipping details for order #${args.orderId}:
- Status: ${details.status}
- Carrier: ${details.carrier}
- Tracking #: ${details.tracking}
- Delivered: ${details.delivered}`
          };
        } else {
          return {
            output: `Shipping details for order #${args.orderId}:
- Status: ${details.status}
- Carrier: ${details.carrier}
- Tracking #: ${details.tracking}
- Estimated Delivery: ${details.estimatedDelivery}`
          };
        }
      } catch (error) {
        logger.error(`Error fetching shipping details: ${error}`);
        return {
          output: `Error retrieving shipping details: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  },
  {
    name: 'getRecommendations',
    description: 'Get product recommendations for a user',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or username' },
        category: { type: 'string', description: 'Optional category filter' }
      },
      required: ['userId'],
      additionalProperties: false
    },
    func: async (args: { userId: string, category?: string }): Promise<ToolResult> => {
      logger.info(`Getting recommendations for ${args.userId}${args.category ? ` in category ${args.category}` : ''}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 400));
      
      try {
        // Check if user exists
        const user = userStore[args.userId];
        if (!user) {
          return {
            output: `User ${args.userId} not found`
          };
        }
        
        // Define product recommendation types
        interface Product {
          name: string;
          price: number;
        }
        
        interface ProductRecommendations {
          [category: string]: Product[];
        }
        
        // Recommendations based on user preferences
        const allRecommendations: ProductRecommendations = {
          electronics: [
            { name: 'Wireless Charging Pad', price: 34.99 },
            { name: 'Bluetooth Speaker', price: 79.99 },
            { name: 'Noise-Cancelling Earbuds', price: 149.99 },
            { name: 'Smart Home Hub', price: 129.99 }
          ],
          home: [
            { name: 'Robot Vacuum', price: 299.99 },
            { name: 'Air Purifier', price: 149.99 },
            { name: 'Smart Light Bulbs (4-pack)', price: 59.99 },
            { name: 'Coffee Maker', price: 89.99 }
          ],
          fashion: [
            { name: 'Leather Wallet', price: 49.99 },
            { name: 'Sunglasses', price: 129.99 },
            { name: 'Watch', price: 199.99 },
            { name: 'Backpack', price: 79.99 }
          ],
          books: [
            { name: 'Bestselling Novel', price: 24.99 },
            { name: 'Cookbook', price: 29.99 },
            { name: 'Biography', price: 19.99 },
            { name: 'Self-Help Book', price: 15.99 }
          ],
          beauty: [
            { name: 'Face Cream', price: 39.99 },
            { name: 'Perfume', price: 89.99 },
            { name: 'Hair Styling Kit', price: 49.99 },
            { name: 'Makeup Palette', price: 59.99 }
          ],
          sports: [
            { name: 'Running Shoes', price: 129.99 },
            { name: 'Yoga Mat', price: 45.99 },
            { name: 'Fitness Tracker', price: 99.99 },
            { name: 'Water Bottle', price: 19.99 }
          ]
        };
        
        // Filter by category if provided
        let recommendations: Product[] = [];
        
        if (args.category && allRecommendations[args.category]) {
          recommendations = allRecommendations[args.category];
        } else {
          // Use user preferences to select recommendations
          for (const category of user.preferences.categories) {
            if (allRecommendations[category]) {
              recommendations.push(...allRecommendations[category].slice(0, 2));
            }
          }
        }
        
        // Format recommendations
        const recommendationsText = recommendations
          .slice(0, 4)
          .map((item, index) => `${index + 1}. ${item.name} ($${item.price})`)
          .join('\n');
        
        return {
          output: `Recommended products for ${args.userId}:\n${recommendationsText}`
        };
      } catch (error) {
        logger.error(`Error fetching recommendations: ${error}`);
        return {
          output: `Error retrieving recommendations: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  }
];

/**
 * Custom logger that formats tool tracing nicely for the console
 */
const traceLogger = {
  debug: () => {}, // Skip debug logs
  info: (message: string, ...args: any[]) => {
    if (message.includes('Getting ')) {
      // Format tool call nicely
      if (message.includes('profile')) {
        console.log(`\n📊 ${message}`, ...args);
      } else if (message.includes('order history')) {
        console.log(`\n🛒 ${message}`, ...args);
      } else if (message.includes('shipping')) {
        console.log(`\n📦 ${message}`, ...args);
      } else if (message.includes('recommendations')) {
        console.log(`\n🔍 ${message}`, ...args);
      } else {
        console.log(`\nℹ️ ${message}`, ...args);
      }
    } else if (message.includes('Processing')) {
      // Format subtask processing
      console.log(`\n⏩ ${message}`, ...args);
    } else if (message.includes('Received')) {
      console.log(`\n📩 ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`\n⚠️ ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`\n❌ ${message}`, ...args);
  }
};

// Create a utility to track the execution tree visually
const executionTracker = {
  depth: 0,
  toolCalls: [] as Array<{
    id: string, 
    name: string, 
    parentId?: string,
    args: any, 
    result?: string
  }>,
  
  startToolCall(id: string, name: string, args: any, parentId?: string) {
    this.toolCalls.push({ id, name, args, parentId });
    this.depth++;
    const indent = '  '.repeat(this.depth - 1);
    console.log(`\n${indent}🔽 Starting ${name}(${JSON.stringify(args)})`);
  },
  
  endToolCall(id: string, result: string) {
    const toolCall = this.toolCalls.find(tc => tc.id === id);
    if (toolCall) {
      toolCall.result = result;
    }
    const indent = '  '.repeat(this.depth - 1);
    console.log(`${indent}🔼 Completed ${this.toolCalls.find(tc => tc.id === id)?.name}`);
    this.depth--;
  },
  
  printExecutionTree() {
    console.log('\n📋 Execution Tree:');
    
    // Group by parent
    const grouped: Record<string, typeof this.toolCalls> = {};
    const roots: typeof this.toolCalls = [];
    
    // First pass - group by parent
    for (const call of this.toolCalls) {
      if (!call.parentId) {
        roots.push(call);
      } else {
        if (!grouped[call.parentId]) {
          grouped[call.parentId] = [];
        }
        grouped[call.parentId].push(call);
      }
    }
    
    // Recursive printer with enhanced formatting
    const printNode = (node: typeof this.toolCalls[0], depth = 0) => {
      const indent = '  '.repeat(depth);
      const prefix = depth === 0 ? '📍 ' : depth === 1 ? '├─ ' : '│  '.repeat(depth - 1) + '├─ ';
      
      // Simplify args display for cleaner output
      const argsStr = JSON.stringify(node.args)
        .replace(/^\{|\}$/g, '')  // Remove outer braces
        .replace(/"([^"]+)":/g, '$1:')  // Remove quotes around property names
        .replace(/"/g, "'");  // Convert double quotes to single quotes
      
      console.log(`${indent}${prefix}${node.name}(${argsStr})`);
      
      const children = grouped[node.id] || [];
      for (const child of children) {
        printNode(child, depth + 1);
      }
    };
    
    // Print each root
    for (const root of roots) {
      printNode(root);
    }
  }
};

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
  
  // Use a default user ID
  console.log('Available user IDs: user123, user456');
  let userId = 'user123';
  
  // Try to use readline-sync if possible, but don't require it
  try {
    const readline = require('readline-sync');
    userId = readline.question('Enter a user ID to look up (default: user123): ') || 'user123';
  } catch (error) {
    console.log(`Using default user ID: ${userId}`);
  }
  
  // Initialize with system message
  const messages: Message[] = [
    { 
      role: 'system', 
      content: 'You are an AI assistant for an e-commerce platform. You can look up user profiles, order history, and recommendations. Be concise but comprehensive.' 
    },
    {
      role: 'user',
      content: `Tell me about ${userId}'s profile, recent purchases, and what products they might like.`
    }
  ];
    
  try {
    console.log('\n🔄 Running chat with tools and subtasks...');
      
    // Create a wrapped version of each tool that tracks execution
    // We need a recursive wrapper that correctly tracks parent-child relationships
    function createTrackedTool(tool: Tool, parentId?: string): Tool {
      return {
        ...tool,
        func: async (args: any) => {
          const id = `call_${Math.random().toString(36).substring(2, 9)}`;
          executionTracker.startToolCall(id, tool.name, args, parentId);
          
          try {
            // Call the original tool function
            const result = await tool.func(args);
            
            // Process the result
            if (typeof result === 'string') {
              executionTracker.endToolCall(id, result);
              return { output: result };
            } else {
              executionTracker.endToolCall(id, result.output);
              
              // Process subtasks if any
              if (result.subTasks && result.subTasks.length > 0) {
                // Create wrapped functions for each subtask
                const wrappedSubTasks: SubTask[] = [];
                
                for (const subTask of result.subTasks) {
                  const subTool = tools.find(t => t.name === subTask.toolName);
                  if (!subTool) {
                    throw new Error(`SubTask tool '${subTask.toolName}' not found`);
                  }
                  
                  // Create a unique ID for this subtask
                  const subtaskId = `subtask_${Math.random().toString(36).substring(2, 9)}`;
                  
                  // Create a wrapped version of the subtask function
                  const wrappedFunc = async (subArgs: any) => {
                    executionTracker.startToolCall(subtaskId, subTask.toolName, subArgs, id);
                    try {
                      const subResult = await subTool.func(subArgs);
                      if (typeof subResult === 'string') {
                        executionTracker.endToolCall(subtaskId, subResult);
                        return { output: subResult };
                      } else {
                        executionTracker.endToolCall(subtaskId, subResult.output);
                        return subResult;
                      }
                    } catch (error) {
                      const errorMsg = error instanceof Error ? error.message : String(error);
                      executionTracker.endToolCall(subtaskId, `Error: ${errorMsg}`);
                      throw error;
                    }
                  };
                  
                  // Replace the original tool with our wrapped version
                  const wrappedTool: Tool = {
                    ...subTool,
                    func: wrappedFunc
                  };
                  
                  // Find the index of this tool in the tools array
                  const toolIndex = tools.findIndex(t => t.name === subTask.toolName);
                  if (toolIndex >= 0) {
                    // Replace the tool in the tools array
                    tools[toolIndex] = wrappedTool;
                  }
                  
                  // Add the subtask to our list
                  wrappedSubTasks.push(subTask);
                }
                
                return {
                  ...result,
                  subTasks: wrappedSubTasks
                };
              }
              
              return result;
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            executionTracker.endToolCall(id, `Error: ${errorMsg}`);
            throw error;
          }
        }
      };
    }
    
    // Map all tools to their tracked versions
    const trackedTools = tools.map(tool => createTrackedTool(tool));
    
    // Run chat with tools
    const response = await runChatWithTools(messages, trackedTools, {
      temperature: 0.7,
      modelName: 'gpt-4o-mini',
      logger: traceLogger,
      timeoutMs: 30000,
      maxRetries: 2
    });
    
    console.log(`\n🤖 Assistant's final response:\n${response}`);
    
    // Always show the execution tree in non-interactive mode
    let showTree = true;
    
    // Try to use readline-sync if possible
    try {
      const readline = require('readline-sync');
      showTree = readline.keyInYN('\nWould you like to see the execution tree?');
    } catch (error) {
      console.log('\nShowing execution tree:');
    }
    
    if (showTree) {
      executionTracker.printExecutionTree();
    }
      
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('The request timed out. You might want to try again or check your API key.');
    }
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});