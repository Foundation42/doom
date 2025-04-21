/**
 * HTTP-related tools for web interactions
 */
import { Tool, ToolResult } from '../types';
import fetch from 'node-fetch';
import { safeToolExecution } from './index';

/**
 * Creates a set of HTTP-related tools
 * @returns An array of HTTP-related tools
 */
export function createHttpTools(): Tool[] {
  return [
    fetchUrlTool,
    searchWebTool,
    extractDataTool
  ];
}

/**
 * A tool for fetching content from a URL
 */
export const fetchUrlTool: Tool = {
  name: 'fetchUrl',
  description: 'Fetches content from a URL and returns the response text. Handles both GET and POST requests.',
  parameters: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'The URL to fetch data from' 
      },
      method: { 
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
        description: 'HTTP method to use (GET, POST, etc.)',
        default: 'GET'
      },
      headers: { 
        type: 'object', 
        description: 'Optional HTTP headers to include' 
      },
      body: { 
        type: 'string', 
        description: 'Optional body for POST requests' 
      },
      timeoutMs: { 
        type: 'number', 
        description: 'Optional timeout in milliseconds',
        default: 10000
      }
    },
    required: ['url'],
    additionalProperties: false
  },
  func: async (args: { 
    url: string; 
    method?: string; 
    headers?: Record<string, string>; 
    body?: string;
    timeoutMs?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { url, method = 'GET', headers = {}, body, timeoutMs = 10000 } = args;
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        // Make the request
        const response = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
          signal: controller.signal as any
        });
        
        // Check for errors
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        // Get response
        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';
        
        // Check if response is JSON and parse it
        let formatted: string;
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(text);
            formatted = JSON.stringify(json, null, 2);
          } catch {
            formatted = text;
          }
        } else {
          formatted = text;
        }
        
        // Return summarized metadata + content
        return {
          output: `Successfully fetched ${url} (${response.status} ${response.statusText}):\n\n${formatted.substring(0, 2000)}${formatted.length > 2000 ? '...(truncated)' : ''}`,
          metadata: {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            size: text.length,
            url: response.url
          }
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }, (error) => {
      return `Failed to fetch ${args.url}: ${error.message}`;
    });
  }
};

/**
 * A tool that simulates a web search (without actually making external requests)
 */
export const searchWebTool: Tool = {
  name: 'searchWeb',
  description: 'Searches the web for information on a given query',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'The search query' 
      },
      numResults: { 
        type: 'number', 
        description: 'Number of results to return',
        default: 3
      }
    },
    required: ['query'],
    additionalProperties: false
  },
  func: async (args: { query: string; numResults?: number }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { query, numResults = 3 } = args;
      
      // Simulate search results (in a real implementation, this would use a search API)
      const results = [
        {
          title: `Information about ${query}`,
          url: `https://example.com/info/${encodeURIComponent(query)}`,
          snippet: `Comprehensive information about ${query} including history, key facts, and related topics.`
        },
        {
          title: `Latest news on ${query}`,
          url: `https://example.com/news/${encodeURIComponent(query)}`,
          snippet: `Breaking news and recent developments related to ${query} from reliable sources.`
        },
        {
          title: `${query} research papers`,
          url: `https://example.com/research/${encodeURIComponent(query)}`,
          snippet: `Academic research papers and studies about ${query} from top universities and research institutions.`
        },
        {
          title: `${query} analysis and expert opinions`,
          url: `https://example.com/analysis/${encodeURIComponent(query)}`,
          snippet: `Expert analysis and opinions about ${query} from industry leaders and analysts.`
        },
        {
          title: `${query} tutorials and guides`,
          url: `https://example.com/tutorials/${encodeURIComponent(query)}`,
          snippet: `Step-by-step tutorials and comprehensive guides about ${query} for beginners and advanced users.`
        }
      ];
      
      // Limit results to requested number
      const limitedResults = results.slice(0, numResults);
      
      // Format search results
      const formattedResults = limitedResults.map((result, index) => 
        `${index + 1}. [${result.title}](${result.url})\n   ${result.snippet}`
      ).join('\n\n');
      
      return {
        output: `Search results for "${query}":\n\n${formattedResults}`,
        subTasks: [
          {
            toolName: 'fetchUrl',
            args: { url: limitedResults[0].url }
          }
        ]
      };
    }, (error) => {
      return `Search failed: ${error.message}`;
    });
  }
};

/**
 * A tool for extracting structured data from HTML or unstructured text
 */
export const extractDataTool: Tool = {
  name: 'extractData',
  description: 'Extracts structured data from HTML or text content, based on specified selectors or patterns',
  parameters: {
    type: 'object',
    properties: {
      content: { 
        type: 'string', 
        description: 'The HTML or text content to extract data from' 
      },
      dataType: { 
        type: 'string',
        enum: ['table', 'list', 'contact', 'product', 'date', 'custom'],
        description: 'The type of data to extract' 
      },
      pattern: { 
        type: 'string', 
        description: 'Optional regex pattern for custom extraction' 
      }
    },
    required: ['content', 'dataType'],
    additionalProperties: false
  },
  func: async (args: { 
    content: string; 
    dataType: string; 
    pattern?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { content, dataType, pattern } = args;
      
      // In a real implementation, this would use libraries like cheerio, 
      // regex extraction, or even ML-based entity extraction
      
      // Simple example implementation for demonstration
      switch (dataType) {
        case 'table':
          return {
            output: `Extracted table data from content (${content.length} chars)`,
            data: [
              { column1: 'Row 1 Data', column2: 'Row 1 More Data' },
              { column1: 'Row 2 Data', column2: 'Row 2 More Data' }
            ]
          };
        
        case 'list':
          return {
            output: `Extracted list items from content (${content.length} chars)`,
            data: [
              'Item 1', 
              'Item 2', 
              'Item 3'
            ]
          };
          
        case 'date':
          // Simple regex for date extraction (very basic)
          const dateMatch = content.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);
          return {
            output: `Extracted date: ${dateMatch ? dateMatch[0] : 'No date found'}`,
            data: dateMatch ? dateMatch[0] : null
          };
          
        case 'custom':
          if (!pattern) {
            return { 
              output: 'Error: Custom extraction requires a pattern parameter',
              error: 'Missing pattern for custom extraction'
            };
          }
          
          try {
            const regex = new RegExp(pattern, 'g');
            const matches = [...content.matchAll(regex)].map(m => m[0]);
            
            return {
              output: `Found ${matches.length} matches using pattern "${pattern}"`,
              data: matches
            };
          } catch (error) {
            return { 
              output: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
              error: 'Invalid regex pattern'
            };
          }
          
        default:
          return { 
            output: `Extraction not implemented for data type: ${dataType}`,
            error: 'Unsupported data type'
          };
      }
    }, (error) => {
      return `Data extraction failed: ${error.message}`;
    });
  }
};