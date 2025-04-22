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
        const validationErrors = validateAgainstSchema(parsedData, schema);
        
        if (validationErrors.length > 0) {
          const formatted = prettify 
            ? JSON.stringify(parsedData, null, 2) 
            : JSON.stringify(parsedData);
          
          return {
            output: `JSON validation failed against schema. The following errors were found:\n- ${validationErrors.join('\n- ')}\n\nData:\n${formatted}`,
            error: 'Schema validation failed',
            data: parsedData,
            validationErrors,
            formatted: prettify ? formatted : undefined
          };
        }
      }
      
      // Helper function to validate data against a schema
      function validateAgainstSchema(data: any, schema: any, path: string = ''): string[] {
        const errors: string[] = [];
        
        // Type validation
        if (schema.type) {
          if (schema.type === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
            errors.push(`${path || 'Root'}: Expected object, got ${Array.isArray(data) ? 'array' : typeof data}`);
          } else if (schema.type === 'array' && !Array.isArray(data)) {
            errors.push(`${path || 'Root'}: Expected array, got ${typeof data}`);
          } else if (schema.type === 'string' && typeof data !== 'string') {
            errors.push(`${path || 'Root'}: Expected string, got ${typeof data}`);
          } else if (schema.type === 'number' && typeof data !== 'number') {
            errors.push(`${path || 'Root'}: Expected number, got ${typeof data}`);
          } else if (schema.type === 'boolean' && typeof data !== 'boolean') {
            errors.push(`${path || 'Root'}: Expected boolean, got ${typeof data}`);
          } else if (schema.type === 'null' && data !== null) {
            errors.push(`${path || 'Root'}: Expected null, got ${typeof data}`);
          }
        }
        
        // Required properties
        if (schema.type === 'object' && schema.required && Array.isArray(schema.required)) {
          for (const prop of schema.required) {
            if (data === null || data === undefined || !(prop in data)) {
              errors.push(`${path || 'Root'}: Missing required property: ${prop}`);
            }
          }
        }
        
        // Object properties validation
        if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (propName in data) {
              const propPath = path ? `${path}.${propName}` : propName;
              errors.push(...validateAgainstSchema(data[propName], propSchema, propPath));
            }
          }
        }
        
        // Array items validation
        if (schema.type === 'array' && schema.items && Array.isArray(data)) {
          data.forEach((item, index) => {
            const itemPath = path ? `${path}[${index}]` : `[${index}]`;
            errors.push(...validateAgainstSchema(item, schema.items, itemPath));
          });
        }
        
        // Enum validation
        if (schema.enum && Array.isArray(schema.enum)) {
          if (!schema.enum.includes(data)) {
            errors.push(`${path || 'Root'}: Value must be one of [${schema.enum.join(', ')}], got ${data}`);
          }
        }
        
        // Numeric constraints
        if (typeof data === 'number') {
          if (schema.minimum !== undefined && data < schema.minimum) {
            errors.push(`${path || 'Root'}: Value ${data} is less than minimum ${schema.minimum}`);
          }
          if (schema.maximum !== undefined && data > schema.maximum) {
            errors.push(`${path || 'Root'}: Value ${data} is greater than maximum ${schema.maximum}`);
          }
        }
        
        // String constraints
        if (typeof data === 'string') {
          if (schema.minLength !== undefined && data.length < schema.minLength) {
            errors.push(`${path || 'Root'}: String length ${data.length} is less than minLength ${schema.minLength}`);
          }
          if (schema.maxLength !== undefined && data.length > schema.maxLength) {
            errors.push(`${path || 'Root'}: String length ${data.length} is greater than maxLength ${schema.maxLength}`);
          }
          if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(data)) {
              errors.push(`${path || 'Root'}: String does not match pattern ${schema.pattern}`);
            }
          }
        }
        
        // Array constraints
        if (Array.isArray(data)) {
          if (schema.minItems !== undefined && data.length < schema.minItems) {
            errors.push(`${path || 'Root'}: Array length ${data.length} is less than minItems ${schema.minItems}`);
          }
          if (schema.maxItems !== undefined && data.length > schema.maxItems) {
            errors.push(`${path || 'Root'}: Array length ${data.length} is greater than maxItems ${schema.maxItems}`);
          }
        }
        
        return errors;
      }
      
      // Format the output
      const formatted = prettify 
        ? JSON.stringify(parsedData, null, 2) 
        : JSON.stringify(parsedData);
      
      return {
        output: `Successfully parsed JSON data:\n\n${formatted.substring(0, 1000)}${formatted.length > 1000 ? '...(truncated)' : ''}`,
        data: parsedData,
        formatted: prettify ? formatted : undefined,
        schema: schema ? true : undefined,
        isValid: schema ? true : undefined
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
        description: 'The CSV data to process or JSON data to convert to CSV' 
      },
      inputFormat: {
        type: 'string',
        enum: ['csv', 'json'],
        description: 'Format of the input data',
        default: 'csv'
      },
      outputFormat: {
        type: 'string',
        enum: ['csv', 'json', 'table'],
        description: 'Format of the output data',
        default: 'json'
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
      quote: {
        type: 'string',
        description: 'Quote character for CSV fields',
        default: '"'
      },
      escapeChar: {
        type: 'string',
        description: 'Character to escape quotes in CSV fields',
        default: '"'
      },
      filterColumn: {
        type: 'string',
        description: 'Column to filter on (if filtering is needed)'
      },
      filterValue: {
        type: 'string',
        description: 'Value to filter by (if filtering is needed)'
      },
      filterOperator: {
        type: 'string',
        enum: ['=', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'],
        description: 'Operator to use for filtering',
        default: '='
      },
      transformations: {
        type: 'array',
        description: 'Transformations to apply to columns',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            operation: { 
              type: 'string', 
              enum: ['uppercase', 'lowercase', 'trim', 'number', 'dateFormat', 'replace'] 
            },
            from: { type: 'string', description: 'For replace operation - text to replace' },
            to: { type: 'string', description: 'For replace operation - replacement text' },
            format: { type: 'string', description: 'For dateFormat operation - date format' }
          },
          required: ['column', 'operation']
        }
      }
    },
    required: ['input'],
    additionalProperties: false
  },
  func: async (args: { 
    input: string; 
    inputFormat?: string; 
    outputFormat?: string; 
    delimiter?: string;
    hasHeader?: boolean;
    quote?: string;
    escapeChar?: string;
    filterColumn?: string;
    filterValue?: string;
    filterOperator?: string;
    transformations?: Array<{ 
      column: string; 
      operation: string;
      from?: string;
      to?: string;
      format?: string;
    }>;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        input, 
        inputFormat = 'csv', 
        outputFormat = 'json', 
        delimiter = ',',
        hasHeader = true,
        quote = '"',
        escapeChar = '"',
        filterColumn,
        filterValue,
        filterOperator = '=',
        transformations = []
      } = args;
      
      let headers: string[] = [];
      let data: any[] = [];
      
      // Parse the input data based on format
      if (inputFormat === 'csv') {
        // Parse CSV with proper handling of quotes and escapes
        const parseCSV = (csv: string): { headers: string[], data: string[][] } => {
          const lines = csv.trim().split('\n');
          if (lines.length === 0) return { headers: [], data: [] };
          
          // Function to parse a CSV line respecting quotes
          const parseLine = (line: string): string[] => {
            const result: string[] = [];
            let inQuote = false;
            let current = '';
            let i = 0;
            
            while (i < line.length) {
              const char = line[i];
              const nextChar = line[i + 1];
              
              // Handle quote character
              if (char === quote) {
                if (inQuote && nextChar === quote) {
                  // Escaped quote inside quoted field
                  current += quote;
                  i += 2; // Skip the escaped quote
                  continue;
                }
                // Toggle quote state
                inQuote = !inQuote;
                i++;
                continue;
              }
              
              // Handle delimiter
              if (char === delimiter && !inQuote) {
                result.push(current);
                current = '';
                i++;
                continue;
              }
              
              // Normal character
              current += char;
              i++;
            }
            
            // Add the last field
            result.push(current);
            return result;
          };
          
          const parsedLines = lines.map(parseLine);
          const headers = hasHeader ? parsedLines[0].map(h => h.trim()) : [];
          const data = hasHeader ? parsedLines.slice(1) : parsedLines;
          
          return { headers, data };
        };
        
        const parsed = parseCSV(input);
        headers = parsed.headers;
        data = parsed.data;
      } else if (inputFormat === 'json') {
        // Parse JSON input
        try {
          const jsonData = JSON.parse(input);
          
          if (Array.isArray(jsonData)) {
            if (jsonData.length > 0) {
              if (typeof jsonData[0] === 'object' && jsonData[0] !== null) {
                // Array of objects - extract headers from first object
                headers = Object.keys(jsonData[0]);
                data = jsonData.map(item => headers.map(h => item[h]?.toString() || ''));
              } else {
                // Array of arrays
                headers = [];
                data = jsonData.map(row => 
                  Array.isArray(row) ? row.map(cell => cell?.toString() || '') : [row?.toString() || '']
                );
              }
            }
          } else if (typeof jsonData === 'object' && jsonData !== null) {
            // Single object
            headers = Object.keys(jsonData);
            data = [headers.map(h => jsonData[h]?.toString() || '')];
          } else {
            throw new Error('Invalid JSON format - expected array or object');
          }
        } catch (error) {
          return {
            output: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
            error: 'Invalid JSON input'
          };
        }
      }
      
      // Apply filtering if requested
      if (filterColumn && filterValue !== undefined) {
        const columnIndex = headers.indexOf(filterColumn);
        
        if (columnIndex >= 0) {
          data = data.filter(row => {
            const cellValue = row[columnIndex];
            
            // Apply the appropriate comparison
            switch (filterOperator) {
              case '=':
                return cellValue === filterValue;
              case '!=':
                return cellValue !== filterValue;
              case '>':
                return parseFloat(cellValue) > parseFloat(filterValue);
              case '<':
                return parseFloat(cellValue) < parseFloat(filterValue);
              case '>=':
                return parseFloat(cellValue) >= parseFloat(filterValue);
              case '<=':
                return parseFloat(cellValue) <= parseFloat(filterValue);
              case 'contains':
                return cellValue.includes(filterValue);
              case 'startsWith':
                return cellValue.startsWith(filterValue);
              case 'endsWith':
                return cellValue.endsWith(filterValue);
              default:
                return true;
            }
          });
        }
      }
      
      // Apply transformations if specified
      if (transformations.length > 0 && headers.length > 0) {
        data = data.map(row => {
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
                case 'dateFormat':
                  // Basic date formatting for demonstration
                  try {
                    const date = new Date(newRow[columnIndex]);
                    if (!isNaN(date.getTime())) {
                      if (transform.format === 'ISO') {
                        newRow[columnIndex] = date.toISOString();
                      } else if (transform.format === 'simple') {
                        newRow[columnIndex] = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                      } else {
                        newRow[columnIndex] = date.toLocaleDateString();
                      }
                    }
                  } catch (e) {
                    // Keep original if error
                  }
                  break;
                case 'replace':
                  if (transform.from && transform.to) {
                    newRow[columnIndex] = newRow[columnIndex].replace(
                      new RegExp(transform.from, 'g'), 
                      transform.to
                    );
                  }
                  break;
              }
            }
          });
          
          return newRow;
        });
      }
      
      // Format the output based on requested format
      if (outputFormat === 'json') {
        // Format as JSON objects if we have headers
        const jsonData = headers.length > 0
          ? data.map(row => {
              const obj: Record<string, string> = {};
              headers.forEach((header, i) => {
                obj[header] = row[i] || '';
              });
              return obj;
            })
          : data; // Return as array of arrays if no headers
          
        return {
          output: `Processed CSV data with ${data.length} rows and ${headers.length || data[0]?.length || 0} columns`,
          data: jsonData
        };
      } else if (outputFormat === 'csv') {
        // Format as CSV
        // Helper to properly escape CSV values
        const escapeCSV = (value: string): string => {
          if (value.includes(delimiter) || value.includes(quote) || value.includes('\n')) {
            // Escape quotes by doubling them
            const escaped = value.replace(new RegExp(quote, 'g'), quote + quote);
            return `${quote}${escaped}${quote}`;
          }
          return value;
        };
        
        const csvLines = [];
        
        // Add headers if present
        if (headers.length > 0) {
          csvLines.push(headers.map(escapeCSV).join(delimiter));
        }
        
        // Add data rows
        for (const row of data) {
          csvLines.push(row.map(escapeCSV).join(delimiter));
        }
        
        return {
          output: `Processed CSV data with ${data.length} rows and ${headers.length || data[0]?.length || 0} columns`,
          data: csvLines.join('\n')
        };
      } else if (outputFormat === 'table') {
        // Format as ASCII table (for display purposes)
        const formatTable = (headers: string[], data: string[][]): string => {
          if (data.length === 0) return 'Empty table';
          
          // Calculate column widths
          const allRows = headers.length > 0 ? [headers, ...data] : data;
          const columnCount = Math.max(...allRows.map(row => row.length));
          const columnWidths: number[] = [];
          
          for (let i = 0; i < columnCount; i++) {
            columnWidths.push(Math.max(...allRows.map(row => (row[i] || '').toString().length), 5));
          }
          
          // Create separator line
          const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
          
          // Format rows
          const formatRow = (row: string[]): string => {
            return '| ' + row.map((cell, i) => {
              const value = (cell || '').toString();
              return value.padEnd(columnWidths[i]);
            }).join(' | ') + ' |';
          };
          
          // Assemble table
          const tableRows = [];
          tableRows.push(separator);
          
          if (headers.length > 0) {
            tableRows.push(formatRow(headers));
            tableRows.push(separator);
          }
          
          data.forEach(row => {
            tableRows.push(formatRow(row));
          });
          
          tableRows.push(separator);
          return tableRows.join('\n');
        };
        
        const table = formatTable(headers, data);
        
        return {
          output: `Processed CSV data with ${data.length} rows and ${headers.length || data[0]?.length || 0} columns\n\n${table}`,
          data: {
            headers,
            rows: data
          }
        };
      }
      
      // Default case if no format matched
      return {
        output: `Output format not supported: ${outputFormat}`,
        error: 'Unsupported output format'
      };
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