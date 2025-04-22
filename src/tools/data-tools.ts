/**
 * Data processing tools for working with structured data
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution, delay } from './index';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Creates a set of data processing tools
 * @returns An array of data processing tools
 */
export function createDataTools(): Tool[] {
  return [
    jsonParserTool,
    csvTool,
    filterDataTool,
    chartGeneratorTool
  ];
}

/**
 * A tool for parsing and validating JSON data
 */
export const jsonParserTool: Tool = {
  name: 'parseJson',
  description: 'Parses, validates, and formats JSON data',
  parameters: {
    type: 'object',
    properties: {
      input: { 
        type: 'string', 
        description: 'The JSON string to parse' 
      },
      schema: { 
        type: 'object', 
        description: 'Optional JSON schema for validation' 
      },
      prettify: { 
        type: 'boolean', 
        description: 'Whether to prettify the output',
        default: true 
      }
    },
    required: ['input'],
    additionalProperties: false
  },
  func: async (args: { 
    input: string; 
    schema?: Record<string, any>; 
    prettify?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { input, schema, prettify = true } = args;
      
      // Parse the JSON
      const parsedData = JSON.parse(input);
      
      // Validate against schema if provided
      if (schema) {
        // In a real implementation, use a library like ajv for validation
        // This is a simple placeholder
        const validationIssues: string[] = [];
        
        // Simple type checking for demonstration
        if (schema.type === 'object' && typeof parsedData !== 'object') {
          validationIssues.push(`Expected object, got ${typeof parsedData}`);
        } else if (schema.type === 'array' && !Array.isArray(parsedData)) {
          validationIssues.push(`Expected array, got ${typeof parsedData}`);
        }
        
        // Required properties check
        if (schema.required && Array.isArray(schema.required)) {
          for (const prop of schema.required) {
            if (!(prop in parsedData)) {
              validationIssues.push(`Missing required property: ${prop}`);
            }
          }
        }
        
        if (validationIssues.length > 0) {
          return {
            output: `JSON validation failed:\n${validationIssues.join('\n')}`,
            error: 'Validation failed',
            data: parsedData
          };
        }
      }
      
      // Format the output
      const formatted = prettify 
        ? JSON.stringify(parsedData, null, 2) 
        : JSON.stringify(parsedData);
      
      return {
        output: `Successfully parsed JSON data:\n\n${formatted.substring(0, 1000)}${formatted.length > 1000 ? '...(truncated)' : ''}`,
        data: parsedData
      };
    }, (error) => {
      return `JSON parsing failed: ${error.message}`;
    });
  }
};

/**
 * A tool for working with CSV data
 */
export const csvTool: Tool = {
  name: 'processCSV',
  description: 'Processes CSV data - can parse, transform, or convert to JSON',
  parameters: {
    type: 'object',
    properties: {
      input: { 
        type: 'string', 
        description: 'The CSV data to process' 
      },
      operation: { 
        type: 'string',
        enum: ['parse', 'toJson', 'transform'],
        description: 'Operation to perform on the CSV data',
        default: 'parse'
      },
      delimiter: { 
        type: 'string', 
        description: 'CSV delimiter character',
        default: ',' 
      },
      hasHeader: { 
        type: 'boolean', 
        description: 'Whether the CSV data has a header row',
        default: true
      },
      transformations: {
        type: 'array',
        description: 'Transformations to apply (for transform operation)',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            operation: { type: 'string', enum: ['uppercase', 'lowercase', 'trim', 'number'] }
          }
        }
      }
    },
    required: ['input'],
    additionalProperties: false
  },
  func: async (args: { 
    input: string; 
    operation?: string; 
    delimiter?: string;
    hasHeader?: boolean;
    transformations?: Array<{ column: string; operation: string }>;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        input, 
        operation = 'parse', 
        delimiter = ',',
        hasHeader = true,
        transformations = []
      } = args;
      
      // Parse CSV
      const lines = input.trim().split('\n');
      const headers = hasHeader ? lines[0].split(delimiter).map(h => h.trim()) : [];
      const dataRows = hasHeader ? lines.slice(1) : lines;
      
      // Convert to array of arrays
      const data = dataRows.map(line => line.split(delimiter).map(cell => cell.trim()));
      
      // Perform the requested operation
      switch (operation) {
        case 'parse':
          return {
            output: `Parsed CSV data with ${data.length} rows and ${headers.length || data[0]?.length || 0} columns`,
            data: {
              headers: hasHeader ? headers : [],
              rows: data
            }
          };
          
        case 'toJson':
          // Convert to array of objects if headers exist
          const jsonData = hasHeader 
            ? data.map(row => {
                const obj: Record<string, string> = {};
                headers.forEach((header, i) => {
                  obj[header] = row[i] || '';
                });
                return obj;
              })
            : data; // Return as array of arrays if no headers
            
          return {
            output: `Converted CSV to JSON with ${jsonData.length} entries`,
            data: jsonData
          };
          
        case 'transform':
          if (!hasHeader) {
            return {
              output: 'Cannot transform CSV without headers',
              error: 'Headers required for transformation'
            };
          }
          
          if (!transformations.length) {
            return {
              output: 'No transformations specified',
              error: 'Missing transformations'
            };
          }
          
          // Apply transformations
          const transformedData = data.map(row => {
            const newRow = [...row];
            
            transformations.forEach(transform => {
              const columnIndex = headers.indexOf(transform.column);
              if (columnIndex >= 0) {
                // Apply the transformation
                switch (transform.operation) {
                  case 'uppercase':
                    newRow[columnIndex] = newRow[columnIndex].toUpperCase();
                    break;
                  case 'lowercase':
                    newRow[columnIndex] = newRow[columnIndex].toLowerCase();
                    break;
                  case 'trim':
                    newRow[columnIndex] = newRow[columnIndex].trim();
                    break;
                  case 'number':
                    newRow[columnIndex] = newRow[columnIndex].replace(/[^0-9.-]/g, '');
                    break;
                }
              }
            });
            
            return newRow;
          });
          
          // Convert back to CSV
          const transformedCsv = [
            headers.join(delimiter),
            ...transformedData.map(row => row.join(delimiter))
          ].join('\n');
          
          return {
            output: `Applied transformations to ${transformedData.length} rows`,
            data: transformedCsv
          };
          
        default:
          return {
            output: `Operation not supported: ${operation}`,
            error: 'Unsupported operation'
          };
      }
    }, (error) => {
      return `CSV processing failed: ${error.message}`;
    });
  }
};

/**
 * A tool for filtering and sorting data
 */
export const filterDataTool: Tool = {
  name: 'filterData',
  description: 'Filters, sorts, and aggregates data based on specified criteria',
  parameters: {
    type: 'object',
    properties: {
      data: { 
        type: 'array', 
        description: 'The array of data objects to filter',
        items: {
          type: 'object',
          description: 'Data object to filter'
        }
      },
      filters: { 
        type: 'array',
        description: 'Filter conditions to apply',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            operator: { 
              type: 'string', 
              enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'in'] 
            },
            value: { 
              type: ['string', 'number', 'boolean', 'array'],
              items: {
                type: ['string', 'number', 'boolean']
              }
            }
          }
        }
      },
      sort: {
        type: 'object',
        description: 'Sorting configuration',
        properties: {
          field: { type: 'string' },
          direction: { type: 'string', enum: ['asc', 'desc'] }
        }
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return'
      }
    },
    required: ['data'],
    additionalProperties: false
  },
  func: async (args: { 
    data: any[]; 
    filters?: Array<{ field: string; operator: string; value: any }>;
    sort?: { field: string; direction: string };
    limit?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { data, filters = [], sort, limit } = args;
      
      if (!Array.isArray(data)) {
        return {
          output: 'Input data must be an array',
          error: 'Invalid input data'
        };
      }
      
      // Apply filters
      let filteredData = [...data];
      
      if (filters.length > 0) {
        filteredData = filteredData.filter(item => {
          // Item must match all filters
          return filters.every(filter => {
            const { field, operator, value } = filter;
            const itemValue = item[field];
            
            switch (operator) {
              case 'equals':
                return itemValue === value;
              case 'notEquals':
                return itemValue !== value;
              case 'contains':
                return String(itemValue).includes(String(value));
              case 'greaterThan':
                return Number(itemValue) > Number(value);
              case 'lessThan':
                return Number(itemValue) < Number(value);
              case 'in':
                return Array.isArray(value) && value.includes(itemValue);
              default:
                return true;
            }
          });
        });
      }
      
      // Apply sorting
      if (sort) {
        const { field, direction } = sort;
        filteredData.sort((a, b) => {
          const valueA = a[field];
          const valueB = b[field];
          
          if (typeof valueA === 'string' && typeof valueB === 'string') {
            return direction === 'asc' 
              ? valueA.localeCompare(valueB) 
              : valueB.localeCompare(valueA);
          } else {
            return direction === 'asc' 
              ? (valueA > valueB ? 1 : -1) 
              : (valueA < valueB ? 1 : -1);
          }
        });
      }
      
      // Apply limit
      if (limit && limit > 0) {
        filteredData = filteredData.slice(0, limit);
      }
      
      // Generate summary statistics
      const totalItems = data.length;
      const filteredItems = filteredData.length;
      
      return {
        output: `Filtered ${totalItems} items down to ${filteredItems} results${sort ? ` (sorted by ${sort.field})` : ''}${limit ? ` (limited to ${limit})` : ''}`,
        data: filteredData
      };
    }, (error) => {
      return `Data filtering failed: ${error.message}`;
    });
  }
};

/**
 * A simple chart generator tool (this would normally use a charting library)
 */
export const chartGeneratorTool: Tool = {
  name: 'generateChart',
  description: 'Generates a chart or visualization from data (simulated for demonstration)',
  parameters: {
    type: 'object',
    properties: {
      data: { 
        type: 'array', 
        description: 'The data to visualize', 
        items: {
          type: 'object',
          description: 'Data point to visualize'
        }
      },
      chartType: { 
        type: 'string',
        enum: ['bar', 'line', 'pie', 'scatter', 'histogram'],
        description: 'The type of chart to generate' 
      },
      xAxis: { 
        type: 'string', 
        description: 'The field to use for the x-axis' 
      },
      yAxis: { 
        type: 'string', 
        description: 'The field to use for the y-axis' 
      },
      title: { 
        type: 'string', 
        description: 'Chart title' 
      }
    },
    required: ['data', 'chartType'],
    additionalProperties: false
  },
  func: async (args: { 
    data: any[]; 
    chartType: string;
    xAxis?: string;
    yAxis?: string;
    title?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { data, chartType, xAxis, yAxis, title } = args;
      
      // Simulate chart generation delay
      await delay(500);
      
      // In a real implementation, this would use a charting library
      // and return a chart image or serialized representation
      
      return {
        output: `Generated ${chartType} chart with ${data.length} data points${title ? ` titled "${title}"` : ''}`,
        chart: {
          type: chartType,
          dataPoints: data.length,
          xAxis,
          yAxis,
          title,
          // This would normally contain chart data or a URL
          url: `https://example.com/charts/${chartType}/${Date.now()}.png`
        }
      };
    }, (error) => {
      return `Chart generation failed: ${error.message}`;
    });
  }
};