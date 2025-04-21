/**
 * Utility tools for general-purpose operations
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution, delay } from './index';
import * as crypto from 'crypto';

/**
 * Creates a set of utility tools
 * @returns An array of utility tools
 */
export function createUtilityTools(): Tool[] {
  return [
    calculatorTool,
    dateTimeTool,
    translationTool,
    stringUtilsTool,
    hashingTool
  ];
}

/**
 * A tool for performing mathematical calculations
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Performs mathematical calculations and unit conversions',
  parameters: {
    type: 'object',
    properties: {
      expression: { 
        type: 'string', 
        description: 'The mathematical expression to evaluate' 
      },
      precision: { 
        type: 'number', 
        description: 'Number of decimal places in the result',
        default: 4
      },
      convert: {
        type: 'object',
        description: 'Optional unit conversion',
        properties: {
          value: { type: 'number' },
          from: { type: 'string' },
          to: { type: 'string' }
        }
      }
    },
    required: ['expression'],
    additionalProperties: false
  },
  func: async (args: { 
    expression: string; 
    precision?: number;
    convert?: { value: number; from: string; to: string };
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { expression, precision = 4, convert } = args;
      
      // Handle unit conversion if requested
      if (convert) {
        const { value, from, to } = convert;
        
        // Simple unit conversion implementation
        // In a real tool, this would be more comprehensive
        const unitConversions: Record<string, Record<string, number>> = {
          length: {
            m: 1,
            km: 1000,
            cm: 0.01,
            mm: 0.001,
            in: 0.0254,
            ft: 0.3048,
            yd: 0.9144,
            mi: 1609.34
          },
          mass: {
            g: 1,
            kg: 1000,
            mg: 0.001,
            lb: 453.592,
            oz: 28.3495
          },
          temperature: {
            // Special case, handled separately
          }
        };
        
        // Special case for temperature
        if (from.toLowerCase() === 'c' && to.toLowerCase() === 'f') {
          const result = (value * 9/5) + 32;
          return {
            output: `${value}°C = ${result.toFixed(precision)}°F`,
            result
          };
        } else if (from.toLowerCase() === 'f' && to.toLowerCase() === 'c') {
          const result = (value - 32) * 5/9;
          return {
            output: `${value}°F = ${result.toFixed(precision)}°C`,
            result
          };
        }
        
        // Find the correct conversion table
        let conversionTable: Record<string, number> | undefined;
        for (const [category, units] of Object.entries(unitConversions)) {
          if (from.toLowerCase() in units && to.toLowerCase() in units) {
            conversionTable = units;
            break;
          }
        }
        
        if (!conversionTable) {
          return {
            output: `Cannot convert from ${from} to ${to}. Unsupported units.`,
            error: 'Unsupported units'
          };
        }
        
        // Perform the conversion
        const valueInBase = value * conversionTable[from.toLowerCase()];
        const result = valueInBase / conversionTable[to.toLowerCase()];
        
        return {
          output: `${value} ${from} = ${result.toFixed(precision)} ${to}`,
          result
        };
      }
      
      // Evaluate mathematical expression
      // WARNING: In a production environment, you should use a safe math evaluator,
      // not eval() which can execute arbitrary code
      
      // Simple expression evaluator
      const calculateExpression = (expr: string): number => {
        // Very basic sanitization (not secure for production!)
        const sanitized = expr
          .replace(/[^0-9+\-*/().%\s]/g, '')  // Only allow safe characters
          .replace(/\*\*/g, '');  // No exponents to keep it simple
        
        // Basic operations
        if (sanitized.includes('+')) {
          const [left, right] = sanitized.split('+');
          return calculateExpression(left) + calculateExpression(right);
        } else if (sanitized.includes('-')) {
          const [left, right] = sanitized.split('-');
          return calculateExpression(left) - calculateExpression(right);
        } else if (sanitized.includes('*')) {
          const [left, right] = sanitized.split('*');
          return calculateExpression(left) * calculateExpression(right);
        } else if (sanitized.includes('/')) {
          const [left, right] = sanitized.split('/');
          return calculateExpression(left) / calculateExpression(right);
        } else if (sanitized.includes('%')) {
          const [left, right] = sanitized.split('%');
          return calculateExpression(left) % calculateExpression(right);
        }
        
        // Just a number
        return parseFloat(sanitized) || 0;
      };
      
      try {
        // In a real implementation, use a safe math evaluator library
        const result = calculateExpression(expression);
        
        return {
          output: `${expression} = ${result.toFixed(precision)}`,
          result
        };
      } catch (error) {
        return {
          output: `Error evaluating expression: ${expression}`,
          error: 'Invalid expression'
        };
      }
    }, (error) => {
      return `Calculation failed: ${error.message}`;
    });
  }
};

/**
 * A tool for working with dates and times
 */
export const dateTimeTool: Tool = {
  name: 'dateTime',
  description: 'Performs operations with dates and times',
  parameters: {
    type: 'object',
    properties: {
      operation: { 
        type: 'string',
        enum: ['format', 'diff', 'add', 'subtract', 'now'],
        description: 'The operation to perform' 
      },
      date: { 
        type: 'string', 
        description: 'The date to operate on (ISO format or natural language)' 
      },
      format: { 
        type: 'string', 
        description: 'Output format for date formatting',
        default: 'YYYY-MM-DD' 
      },
      timeZone: { 
        type: 'string', 
        description: 'Time zone to use',
        default: 'UTC' 
      },
      unit: {
        type: 'string',
        enum: ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'],
        description: 'Unit for addition, subtraction, or difference operations'
      },
      amount: {
        type: 'number',
        description: 'Amount to add or subtract'
      },
      targetDate: {
        type: 'string',
        description: 'Target date for difference calculation'
      }
    },
    required: ['operation'],
    additionalProperties: false
  },
  func: async (args: { 
    operation: string;
    date?: string;
    format?: string;
    timeZone?: string;
    unit?: string;
    amount?: number;
    targetDate?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        operation, 
        date, 
        format = 'YYYY-MM-DD',
        timeZone = 'UTC',
        unit,
        amount,
        targetDate
      } = args;
      
      // For demonstration. In a real implementation, use a library like date-fns or luxon
      
      // Parse the input date
      let inputDate: Date;
      if (date) {
        inputDate = new Date(date);
        if (isNaN(inputDate.getTime())) {
          return {
            output: `Invalid date: ${date}`,
            error: 'Invalid date format'
          };
        }
      } else {
        inputDate = new Date();
      }
      
      // Helper for formatting dates
      const formatDate = (date: Date, format: string): string => {
        // Simple format implementation
        const tokens: Record<string, () => string> = {
          'YYYY': () => date.getFullYear().toString(),
          'YY': () => date.getFullYear().toString().slice(2),
          'MM': () => (date.getMonth() + 1).toString().padStart(2, '0'),
          'M': () => (date.getMonth() + 1).toString(),
          'DD': () => date.getDate().toString().padStart(2, '0'),
          'D': () => date.getDate().toString(),
          'HH': () => date.getHours().toString().padStart(2, '0'),
          'H': () => date.getHours().toString(),
          'mm': () => date.getMinutes().toString().padStart(2, '0'),
          'm': () => date.getMinutes().toString(),
          'ss': () => date.getSeconds().toString().padStart(2, '0'),
          's': () => date.getSeconds().toString(),
          'ddd': () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
          'dddd': () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
          'MMM': () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
          'MMMM': () => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()]
        };
        
        let result = format;
        for (const [token, replacer] of Object.entries(tokens)) {
          result = result.replace(token, replacer());
        }
        
        return result;
      };
      
      // Perform the operation
      switch (operation) {
        case 'now':
          const now = new Date();
          return {
            output: `Current date and time: ${formatDate(now, format)}`,
            date: now.toISOString()
          };
          
        case 'format':
          return {
            output: `Formatted date: ${formatDate(inputDate, format)}`,
            date: inputDate.toISOString()
          };
          
        case 'add':
          if (!unit || amount === undefined) {
            return {
              output: 'Add operation requires unit and amount parameters',
              error: 'Missing parameters'
            };
          }
          
          const resultDate = new Date(inputDate);
          
          // Apply the addition
          switch (unit) {
            case 'years':
              resultDate.setFullYear(resultDate.getFullYear() + amount);
              break;
            case 'months':
              resultDate.setMonth(resultDate.getMonth() + amount);
              break;
            case 'days':
              resultDate.setDate(resultDate.getDate() + amount);
              break;
            case 'hours':
              resultDate.setHours(resultDate.getHours() + amount);
              break;
            case 'minutes':
              resultDate.setMinutes(resultDate.getMinutes() + amount);
              break;
            case 'seconds':
              resultDate.setSeconds(resultDate.getSeconds() + amount);
              break;
            default:
              return {
                output: `Unsupported unit: ${unit}`,
                error: 'Invalid unit'
              };
          }
          
          return {
            output: `Result of adding ${amount} ${unit} to ${formatDate(inputDate, format)}: ${formatDate(resultDate, format)}`,
            date: resultDate.toISOString()
          };
          
        case 'subtract':
          if (!unit || amount === undefined) {
            return {
              output: 'Subtract operation requires unit and amount parameters',
              error: 'Missing parameters'
            };
          }
          
          // Use the add operation with negative amount
          return dateTimeTool.func({
            operation: 'add',
            date,
            format,
            timeZone,
            unit,
            amount: -amount
          });
          
        case 'diff':
          if (!targetDate) {
            return {
              output: 'Diff operation requires targetDate parameter',
              error: 'Missing parameters'
            };
          }
          
          const target = new Date(targetDate);
          if (isNaN(target.getTime())) {
            return {
              output: `Invalid target date: ${targetDate}`,
              error: 'Invalid date format'
            };
          }
          
          // Calculate difference in milliseconds
          const diffMs = target.getTime() - inputDate.getTime();
          const diffSec = Math.floor(diffMs / 1000);
          const diffMin = Math.floor(diffSec / 60);
          const diffHour = Math.floor(diffMin / 60);
          const diffDay = Math.floor(diffHour / 24);
          
          let diffOutput = '';
          if (unit) {
            switch (unit) {
              case 'years':
                const diffYear = diffDay / 365.25;
                diffOutput = `${diffYear.toFixed(2)} years`;
                break;
              case 'months':
                const diffMonth = diffDay / 30.44;
                diffOutput = `${diffMonth.toFixed(2)} months`;
                break;
              case 'weeks':
                const diffWeek = diffDay / 7;
                diffOutput = `${diffWeek.toFixed(2)} weeks`;
                break;
              case 'days':
                diffOutput = `${diffDay} days`;
                break;
              case 'hours':
                diffOutput = `${diffHour} hours`;
                break;
              case 'minutes':
                diffOutput = `${diffMin} minutes`;
                break;
              case 'seconds':
                diffOutput = `${diffSec} seconds`;
                break;
              default:
                diffOutput = `${diffMs} milliseconds`;
            }
          } else {
            // Comprehensive difference
            diffOutput = `${diffDay} days, ${diffHour % 24} hours, ${diffMin % 60} minutes, ${diffSec % 60} seconds`;
          }
          
          return {
            output: `Difference between ${formatDate(inputDate, format)} and ${formatDate(target, format)}: ${diffOutput}`,
            difference: {
              milliseconds: diffMs,
              seconds: diffSec,
              minutes: diffMin,
              hours: diffHour,
              days: diffDay
            }
          };
          
        default:
          return {
            output: `Unsupported operation: ${operation}`,
            error: 'Invalid operation'
          };
      }
    }, (error) => {
      return `Date/time operation failed: ${error.message}`;
    });
  }
};

/**
 * A tool for simulating language translation
 */
export const translationTool: Tool = {
  name: 'translate',
  description: 'Translates text from one language to another (simulated for demonstration)',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to translate' 
      },
      sourceLanguage: { 
        type: 'string', 
        description: 'Source language code (e.g., "en", "es", "fr")',
        default: 'auto'
      },
      targetLanguage: { 
        type: 'string', 
        description: 'Target language code (e.g., "en", "es", "fr")' 
      }
    },
    required: ['text', 'targetLanguage'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    sourceLanguage?: string;
    targetLanguage: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { text, sourceLanguage = 'auto', targetLanguage } = args;
      
      // Simulate translation delay
      await delay(800);
      
      // This is a simulation - in a real implementation, this would call a translation API
      // For demo purposes, we'll just add a language marker
      
      // Language codes map
      const languages: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'hi': 'Hindi'
      };
      
      // Check if languages are supported
      const sourceName = sourceLanguage === 'auto' ? 'Auto-detected' : languages[sourceLanguage];
      const targetName = languages[targetLanguage];
      
      if (!targetName) {
        return {
          output: `Unsupported target language: ${targetLanguage}`,
          error: 'Unsupported language'
        };
      }
      
      if (sourceLanguage !== 'auto' && !sourceName) {
        return {
          output: `Unsupported source language: ${sourceLanguage}`,
          error: 'Unsupported language'
        };
      }
      
      // Simulate translation
      // In a real implementation, this would use a translation service
      const translatedText = `[${targetName} translation of: "${text}"]`;
      
      return {
        output: `Translation from ${sourceName} to ${targetName}:\n"${translatedText}"`,
        translation: translatedText,
        detectedLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage
      };
    }, (error) => {
      return `Translation failed: ${error.message}`;
    });
  }
};

/**
 * A tool for string manipulation operations
 */
export const stringUtilsTool: Tool = {
  name: 'stringUtils',
  description: 'Performs various string manipulation operations',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The input text to process' 
      },
      operation: { 
        type: 'string',
        enum: ['uppercase', 'lowercase', 'titlecase', 'trim', 'replace', 'count', 'split', 'truncate', 'extract'],
        description: 'The operation to perform' 
      },
      pattern: { 
        type: 'string', 
        description: 'Pattern for replace, split, or extract operations' 
      },
      replacement: { 
        type: 'string', 
        description: 'Replacement for replace operation' 
      },
      length: {
        type: 'number',
        description: 'Length for truncate operation'
      }
    },
    required: ['text', 'operation'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    operation: string;
    pattern?: string;
    replacement?: string;
    length?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { text, operation, pattern, replacement, length } = args;
      
      // Helper for title case
      const toTitleCase = (str: string): string => {
        return str.replace(
          /\w\S*/g,
          txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );
      };
      
      switch (operation) {
        case 'uppercase':
          return {
            output: text.toUpperCase(),
            original: text
          };
          
        case 'lowercase':
          return {
            output: text.toLowerCase(),
            original: text
          };
          
        case 'titlecase':
          return {
            output: toTitleCase(text),
            original: text
          };
          
        case 'trim':
          return {
            output: text.trim(),
            original: text
          };
          
        case 'replace':
          if (!pattern) {
            return {
              output: 'Replace operation requires a pattern parameter',
              error: 'Missing pattern'
            };
          }
          
          try {
            const regex = new RegExp(pattern, 'g');
            const result = text.replace(regex, replacement || '');
            
            return {
              output: result,
              original: text,
              replacements: (text.match(regex) || []).length
            };
          } catch (error) {
            return {
              output: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
              error: 'Invalid regex'
            };
          }
          
        case 'count':
          if (!pattern) {
            return {
              output: `Text length: ${text.length} characters`,
              count: text.length
            };
          }
          
          try {
            const regex = new RegExp(pattern, 'g');
            const matches = text.match(regex) || [];
            
            return {
              output: `Found ${matches.length} matches for pattern "${pattern}"`,
              count: matches.length,
              matches: matches.slice(0, 10) // Limit results
            };
          } catch (error) {
            return {
              output: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
              error: 'Invalid regex'
            };
          }
          
        case 'split':
          if (!pattern) {
            return {
              output: 'Split operation requires a pattern parameter',
              error: 'Missing pattern'
            };
          }
          
          const parts = text.split(pattern);
          
          return {
            output: `Split into ${parts.length} parts`,
            parts
          };
          
        case 'truncate':
          if (!length) {
            return {
              output: 'Truncate operation requires a length parameter',
              error: 'Missing length'
            };
          }
          
          if (text.length <= length) {
            return {
              output: text,
              truncated: false
            };
          }
          
          return {
            output: `${text.substring(0, length)}...`,
            truncated: true,
            originalLength: text.length
          };
          
        case 'extract':
          if (!pattern) {
            return {
              output: 'Extract operation requires a pattern parameter',
              error: 'Missing pattern'
            };
          }
          
          try {
            const regex = new RegExp(pattern, 'g');
            const matches = [...text.matchAll(regex)];
            
            if (matches.length === 0) {
              return {
                output: `No matches found for pattern "${pattern}"`,
                matches: []
              };
            }
            
            const extractedItems = matches.map(match => match[0]);
            
            return {
              output: `Extracted ${extractedItems.length} items:\n${extractedItems.join('\n')}`,
              matches: extractedItems
            };
          } catch (error) {
            return {
              output: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
              error: 'Invalid regex'
            };
          }
          
        default:
          return {
            output: `Unsupported operation: ${operation}`,
            error: 'Invalid operation'
          };
      }
    }, (error) => {
      return `String operation failed: ${error.message}`;
    });
  }
};

/**
 * A tool for various cryptographic operations
 */
export const hashingTool: Tool = {
  name: 'cryptoHash',
  description: 'Performs cryptographic hashing, encoding, and generation operations',
  parameters: {
    type: 'object',
    properties: {
      operation: { 
        type: 'string',
        enum: ['hash', 'encode', 'decode', 'generateId', 'generatePassword'],
        description: 'The operation to perform' 
      },
      input: { 
        type: 'string', 
        description: 'The input text to process' 
      },
      algorithm: { 
        type: 'string',
        enum: ['md5', 'sha1', 'sha256', 'sha512', 'base64', 'hex'],
        description: 'The algorithm to use for hashing or encoding',
        default: 'sha256'
      },
      length: {
        type: 'number',
        description: 'Length for generation operations',
        default: 16
      }
    },
    required: ['operation'],
    additionalProperties: false
  },
  func: async (args: { 
    operation: string;
    input?: string;
    algorithm?: string;
    length?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        operation, 
        input = '', 
        algorithm = 'sha256',
        length = 16 
      } = args;
      
      switch (operation) {
        case 'hash':
          if (!input) {
            return {
              output: 'Hash operation requires an input parameter',
              error: 'Missing input'
            };
          }
          
          // Create hash using the specified algorithm
          let hash: string;
          
          switch (algorithm) {
            case 'md5':
            case 'sha1':
            case 'sha256':
            case 'sha512':
              hash = crypto.createHash(algorithm).update(input).digest('hex');
              break;
            default:
              return {
                output: `Unsupported hashing algorithm: ${algorithm}`,
                error: 'Invalid algorithm'
              };
          }
          
          return {
            output: `${algorithm} hash of "${input.substring(0, 20)}${input.length > 20 ? '...' : ''}": ${hash}`,
            hash,
            algorithm
          };
          
        case 'encode':
          if (!input) {
            return {
              output: 'Encode operation requires an input parameter',
              error: 'Missing input'
            };
          }
          
          let encoded: string;
          
          switch (algorithm) {
            case 'base64':
              encoded = Buffer.from(input).toString('base64');
              break;
            case 'hex':
              encoded = Buffer.from(input).toString('hex');
              break;
            default:
              return {
                output: `Unsupported encoding algorithm: ${algorithm}`,
                error: 'Invalid algorithm'
              };
          }
          
          return {
            output: `${algorithm} encoding of "${input.substring(0, 20)}${input.length > 20 ? '...' : ''}": ${encoded}`,
            encoded,
            algorithm
          };
          
        case 'decode':
          if (!input) {
            return {
              output: 'Decode operation requires an input parameter',
              error: 'Missing input'
            };
          }
          
          let decoded: string;
          
          try {
            switch (algorithm) {
              case 'base64':
                decoded = Buffer.from(input, 'base64').toString('utf8');
                break;
              case 'hex':
                decoded = Buffer.from(input, 'hex').toString('utf8');
                break;
              default:
                return {
                  output: `Unsupported decoding algorithm: ${algorithm}`,
                  error: 'Invalid algorithm'
                };
            }
          } catch (error) {
            return {
              output: `Failed to decode input using ${algorithm}: ${error instanceof Error ? error.message : String(error)}`,
              error: 'Decoding failed'
            };
          }
          
          return {
            output: `${algorithm} decoding: "${decoded}"`,
            decoded
          };
          
        case 'generateId':
          // Generate a random ID
          const id = crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .slice(0, length);
            
          return {
            output: `Generated random ID (${length} chars): ${id}`,
            id
          };
          
        case 'generatePassword':
          // Generate a secure random password
          const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
          let password = '';
          
          const bytes = crypto.randomBytes(length);
          for (let i = 0; i < length; i++) {
            const index = bytes[i] % charset.length;
            password += charset[index];
          }
          
          return {
            output: `Generated secure password (${length} chars): ${password}`,
            password
          };
          
        default:
          return {
            output: `Unsupported operation: ${operation}`,
            error: 'Invalid operation'
          };
      }
    }, (error) => {
      return `Crypto operation failed: ${error.message}`;
    });
  }
};