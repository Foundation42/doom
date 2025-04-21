// Main exports from the package
export { runChatWithTools } from './chatrunner';
export type {
  Message,
  ChatMessage,
  ToolMessage,
  ToolCall,
  SubTask,
  ToolResult,
  Tool,
  RunOptions,
  Logger
} from './types';

// Example default logger
import { Logger } from './types';

/**
 * Creates a console-based logger with emojis for better visibility
 */
export function createConsoleLogger(prefix = '', logLevel = 'info'): Logger {
  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  const threshold = levels[logLevel as keyof typeof levels] || 1;
  
  return {
    debug: (message: string, ...args: any[]) => {
      if (levels.debug >= threshold) {
        console.debug(`${prefix}🔍 ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      if (levels.info >= threshold) {
        console.log(`${prefix}ℹ️ ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      if (levels.warn >= threshold) {
        console.warn(`${prefix}⚠️ ${message}`, ...args);
      }
    },
    error: (message: string, ...args: any[]) => {
      if (levels.error >= threshold) {
        console.error(`${prefix}❌ ${message}`, ...args);
      }
    }
  };
}

/**
 * Helper to validate the JSON schema of tool arguments against the parameters schema
 */
export function validateToolArgs(args: any, schema: any): { valid: boolean; errors?: string[] } {
  // Simple validation for now, could be replaced with Ajv or similar
  const errors: string[] = [];
  
  if (schema.type !== 'object') {
    return { valid: false, errors: ['Schema must have type "object"'] };
  }
  
  // Check required properties
  if (schema.required) {
    for (const propName of schema.required) {
      if (args[propName] === undefined) {
        errors.push(`Missing required property: ${propName}`);
      }
    }
  }
  
  // Check property types (basic validation)
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
      if (args[propName] !== undefined) {
        const type = propSchema.type;
        const value = args[propName];
        
        if (type === 'string' && typeof value !== 'string') {
          errors.push(`Property ${propName} should be a string`);
        } else if (type === 'number' && typeof value !== 'number') {
          errors.push(`Property ${propName} should be a number`);
        } else if (type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Property ${propName} should be a boolean`);
        } else if (type === 'array' && !Array.isArray(value)) {
          errors.push(`Property ${propName} should be an array`);
        } else if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
          errors.push(`Property ${propName} should be an object`);
        }
      }
    }
  }
  
  // Check for additional properties if not allowed
  if (schema.additionalProperties === false) {
    const schemaProps = Object.keys(schema.properties || {});
    const extraProps = Object.keys(args).filter(prop => !schemaProps.includes(prop));
    
    if (extraProps.length > 0) {
      errors.push(`Additional properties not allowed: ${extraProps.join(', ')}`);
    }
  }
  
  return { 
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}