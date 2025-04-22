/**
 * File-related tools for working with the filesystem
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as minimatch from 'minimatch';

// Promisified fs functions
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

/**
 * Creates a set of file system tools
 * @returns An array of file-related tools
 */
export function createFileTools(): Tool[] {
  return [
    readFileTool,
    writeFileTool,
    listFilesTool,
    fileInfoTool,
    searchFilesTool
  ];
}

/**
 * A tool for reading file contents
 */
export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Reads content from a file on the filesystem',
  parameters: {
    type: 'object',
    properties: {
      path: { 
        type: 'string', 
        description: 'The path to the file to read' 
      },
      encoding: { 
        type: 'string',
        enum: ['utf8', 'base64', 'hex', 'binary'],
        default: 'utf8',
        description: 'The encoding to use when reading the file' 
      },
      maxBytes: {
        type: 'number',
        description: 'Maximum number of bytes to read (for large files)',
        default: 1024 * 1024 // Default 1MB limit
      }
    },
    required: ['path'],
    additionalProperties: false
  },
  func: async (args: { 
    path: string; 
    encoding?: string;
    maxBytes?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { path: filePath, encoding = 'utf8', maxBytes = 1024 * 1024 } = args;
      
      // Check if file exists
      try {
        await stat(filePath);
      } catch (error) {
        return {
          output: `File not found: ${filePath}`,
          error: 'File not found'
        };
      }
      
      // Get file info
      const fileInfo = await stat(filePath);
      
      // Check if it's a file
      if (!fileInfo.isFile()) {
        return {
          output: `Path is not a file: ${filePath}`,
          error: 'Not a file'
        };
      }
      
      // For large files, warn and read only part
      if (fileInfo.size > maxBytes) {
        // Read the file in chunks for large files
        const fileHandle = await fs.promises.open(filePath, 'r');
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await fileHandle.read(buffer, 0, maxBytes, 0);
        await fileHandle.close();
        
        const data = buffer.toString(encoding as BufferEncoding, 0, bytesRead);
        
        return {
          output: `Read first ${maxBytes} bytes of ${fileInfo.size} total bytes from ${filePath}`,
          content: data.toString().substring(0, maxBytes),
          truncated: true,
          fileSize: fileInfo.size,
          bytesRead: maxBytes
        };
      }
      
      // Normal case for reasonable sized files
      const data = await readFile(filePath, { encoding: encoding as BufferEncoding });
      
      return {
        output: `Successfully read ${fileInfo.size} bytes from ${filePath}`,
        content: data.toString(),
        truncated: false,
        fileSize: fileInfo.size,
        bytesRead: fileInfo.size
      };
    }, (error) => {
      return `Failed to read file: ${error.message}`;
    });
  }
};

/**
 * A tool for writing content to a file
 */
export const writeFileTool: Tool = {
  name: 'writeFile',
  description: 'Writes content to a file on the filesystem',
  parameters: {
    type: 'object',
    properties: {
      path: { 
        type: 'string', 
        description: 'The path to the file to write' 
      },
      content: { 
        type: 'string', 
        description: 'The content to write to the file' 
      },
      encoding: { 
        type: 'string',
        enum: ['utf8', 'base64', 'hex', 'binary'],
        default: 'utf8',
        description: 'The encoding to use when writing the file' 
      },
      append: {
        type: 'boolean',
        description: 'Whether to append to the file instead of overwriting',
        default: false
      },
      createDir: {
        type: 'boolean',
        description: 'Whether to create parent directories if they don\'t exist',
        default: false
      }
    },
    required: ['path', 'content'],
    additionalProperties: false
  },
  func: async (args: { 
    path: string; 
    content: string;
    encoding?: string;
    append?: boolean;
    createDir?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        path: filePath, 
        content, 
        encoding = 'utf8',
        append = false,
        createDir = false
      } = args;
      
      // Create directory if needed
      if (createDir) {
        const dirname = path.dirname(filePath);
        try {
          await mkdir(dirname, { recursive: true });
        } catch (error) {
          // Ignore if directory already exists
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
          }
        }
      }
      
      // Write or append to file
      const flag = append ? 'a' : 'w';
      await writeFile(filePath, content, { encoding: encoding as BufferEncoding, flag });
      
      return {
        output: `Successfully ${append ? 'appended to' : 'wrote'} file ${filePath} (${Buffer.byteLength(content, encoding as BufferEncoding)} bytes)`,
        bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
        path: filePath
      };
    }, (error) => {
      return `Failed to write file: ${error.message}`;
    });
  }
};

/**
 * A tool for listing files in a directory
 */
export const listFilesTool: Tool = {
  name: 'listFiles',
  description: 'Lists files and directories in a specified path',
  parameters: {
    type: 'object',
    properties: {
      path: { 
        type: 'string', 
        description: 'The directory path to list',
        default: '.' 
      },
      pattern: { 
        type: 'string', 
        description: 'Optional glob pattern to filter files (e.g., "*.txt")' 
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list files recursively',
        default: false
      },
      includeHidden: {
        type: 'boolean',
        description: 'Whether to include hidden files (starting with .)',
        default: false
      },
      details: {
        type: 'boolean',
        description: 'Whether to include detailed file information',
        default: false
      }
    },
    required: ['path'],
    additionalProperties: false
  },
  func: async (args: { 
    path: string;
    pattern?: string;
    recursive?: boolean;
    includeHidden?: boolean;
    details?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        path: dirPath, 
        pattern,
        recursive = false,
        includeHidden = false,
        details = false
      } = args;
      
      // Check if directory exists
      try {
        const stats = await stat(dirPath);
        if (!stats.isDirectory()) {
          return {
            output: `Path is not a directory: ${dirPath}`,
            error: 'Not a directory'
          };
        }
      } catch (error) {
        return {
          output: `Directory not found: ${dirPath}`,
          error: 'Directory not found'
        };
      }
      
      // Helper function to list files recursively
      const listFilesRecursive = async (dir: string): Promise<any[]> => {
        const items = await readdir(dir, { withFileTypes: true });
        
        let results: any[] = [];
        
        for (const item of items) {
          // Skip hidden files if not included
          if (!includeHidden && item.name.startsWith('.')) {
            continue;
          }
          
          const fullPath = path.join(dir, item.name);
          
          // Filter by pattern if provided
          if (pattern) {
            if (!minimatch.minimatch(item.name, pattern)) {
              continue;
            }
          }
          
          if (item.isDirectory() && recursive) {
            // Recursively list files in subdirectory
            const subResults = await listFilesRecursive(fullPath);
            results = results.concat(subResults);
          }
          
          // Get file details if requested
          let fileInfo: any = { 
            name: item.name,
            path: fullPath,
            type: item.isDirectory() ? 'directory' : 'file'
          };
          
          if (details) {
            const itemStats = await stat(fullPath);
            fileInfo = {
              ...fileInfo,
              size: itemStats.size,
              created: itemStats.birthtime,
              modified: itemStats.mtime,
              accessed: itemStats.atime,
              permissions: (itemStats.mode & 0o777).toString(8) // Convert to octal
            };
          }
          
          results.push(fileInfo);
        }
        
        return results;
      };
      
      // List files
      const files = await listFilesRecursive(dirPath);
      
      // Helper function to format file sizes
      function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      
      // Prepare a more detailed output
      let outputText = `Found ${files.length} items in ${dirPath}${pattern ? ` matching ${pattern}` : ''}:\n\n`;
      
      // Group files by type
      const directories = files.filter(f => f.type === 'directory');
      const regularFiles = files.filter(f => f.type === 'file');
      
      // Add directories first
      if (directories.length > 0) {
        outputText += `Directories (${directories.length}):\n`;
        directories.forEach(dir => {
          const dirDetails = details && dir.size !== undefined
            ? ` (${dir.items || 0} items, modified: ${new Date(dir.modified).toISOString().split('T')[0]})`
            : '';
          outputText += `  📁 ${dir.name}${dirDetails}\n`;
        });
        outputText += '\n';
      }
      
      // Then add files
      if (regularFiles.length > 0) {
        outputText += `Files (${regularFiles.length}):\n`;
        regularFiles.forEach(file => {
          const sizeStr = details && file.size !== undefined
            ? ` (${formatFileSize(file.size)}, modified: ${new Date(file.modified).toISOString().split('T')[0]})`
            : '';
          outputText += `  📄 ${file.name}${sizeStr}\n`;
        });
      }
      
      return {
        output: outputText,
        files
      };
    }, (error) => {
      return `Failed to list files: ${error.message}`;
    });
  }
};

/**
 * A tool for getting detailed information about a file
 */
export const fileInfoTool: Tool = {
  name: 'fileInfo',
  description: 'Gets detailed information about a file or directory',
  parameters: {
    type: 'object',
    properties: {
      path: { 
        type: 'string', 
        description: 'The path to the file or directory' 
      },
      hash: {
        type: 'boolean',
        description: 'Whether to calculate file hash (can be slow for large files)',
        default: false
      },
      hashAlgorithm: {
        type: 'string',
        enum: ['md5', 'sha1', 'sha256'],
        default: 'sha1',
        description: 'Hash algorithm to use if hash is true'
      }
    },
    required: ['path'],
    additionalProperties: false
  },
  func: async (args: { 
    path: string;
    hash?: boolean;
    hashAlgorithm?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { path: filePath, hash = false, hashAlgorithm = 'sha1' } = args;
      
      // Check if path exists
      try {
        await stat(filePath);
      } catch (error) {
        return {
          output: `Path not found: ${filePath}`,
          error: 'Path not found'
        };
      }
      
      // Get file stats
      const fileStats = await stat(filePath);
      
      // Prepare result
      const result: any = {
        path: filePath,
        name: path.basename(filePath),
        directory: path.dirname(filePath),
        type: fileStats.isFile() ? 'file' : 
              fileStats.isDirectory() ? 'directory' : 
              fileStats.isSymbolicLink() ? 'symlink' : 'other',
        size: fileStats.size,
        created: fileStats.birthtime,
        modified: fileStats.mtime,
        accessed: fileStats.atime,
        permissions: (fileStats.mode & 0o777).toString(8),
        uid: fileStats.uid,
        gid: fileStats.gid
      };
      
      // Calculate hash if requested and it's a file
      if (hash && fileStats.isFile()) {
        const crypto = require('crypto');
        const hash = crypto.createHash(hashAlgorithm);
        const stream = fs.createReadStream(filePath);
        
        await new Promise((resolve, reject) => {
          stream.on('data', (data) => hash.update(data));
          stream.on('end', resolve);
          stream.on('error', reject);
        });
        
        result.hash = {
          algorithm: hashAlgorithm,
          value: hash.digest('hex')
        };
      }
      
      // If it's a directory, include count of items
      if (fileStats.isDirectory()) {
        try {
          const items = await readdir(filePath);
          result.items = items.length;
        } catch (error) {
          result.items = 0;
          result.error = 'Failed to read directory contents';
        }
      }
      
      return {
        output: `File information for ${filePath}:\n` +
                `Type: ${result.type}\n` +
                `Size: ${result.size} bytes\n` +
                `Modified: ${result.modified.toISOString()}\n` +
                (result.hash ? `${result.hash.algorithm} Hash: ${result.hash.value}\n` : '') +
                (result.type === 'directory' ? `Contents: ${result.items} items\n` : ''),
        info: result
      };
    }, (error) => {
      return `Failed to get file info: ${error.message}`;
    });
  }
};

/**
 * A tool for searching file contents
 */
export const searchFilesTool: Tool = {
  name: 'searchFiles',
  description: 'Searches for patterns in files',
  parameters: {
    type: 'object',
    properties: {
      path: { 
        type: 'string', 
        description: 'The directory path to search in',
        default: '.' 
      },
      pattern: { 
        type: 'string', 
        description: 'Text or regular expression pattern to search for' 
      },
      filePattern: { 
        type: 'string', 
        description: 'Optional glob pattern to filter files (e.g., "*.txt")',
        default: '*' 
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 100
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to search recursively through subdirectories',
        default: true
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether the search is case sensitive',
        default: false
      }
    },
    required: ['pattern'],
    additionalProperties: false
  },
  func: async (args: { 
    path?: string;
    pattern: string;
    filePattern?: string;
    maxResults?: number;
    recursive?: boolean;
    caseSensitive?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        path: searchPath = '.', 
        pattern,
        filePattern = '*',
        maxResults = 100,
        recursive = true,
        caseSensitive = false
      } = args;
      
      // Check if directory exists
      try {
        const stats = await stat(searchPath);
        if (!stats.isDirectory()) {
          return {
            output: `Search path is not a directory: ${searchPath}`,
            error: 'Not a directory'
          };
        }
      } catch (error) {
        return {
          output: `Search directory not found: ${searchPath}`,
          error: 'Directory not found'
        };
      }
      
      // Prepare regex
      let searchRegex: RegExp;
      try {
        searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } catch (error) {
        // If not a valid regex, treat as literal text
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escapedPattern, caseSensitive ? 'g' : 'gi');
      }
      
      // Helper function to search files recursively
      const searchFilesRecursive = async (dir: string, results: any[] = []): Promise<any[]> => {
        if (results.length >= maxResults) return results;
        
        const items = await readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          if (results.length >= maxResults) break;
          
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory() && recursive) {
            // Recursive search in subdirectory
            await searchFilesRecursive(fullPath, results);
          } else if (item.isFile()) {
            // Check if file matches the pattern
            if (!minimatch.minimatch(item.name, filePattern)) {
              continue;
            }
            
            try {
              // Read and search file
              const content = await readFile(fullPath, 'utf8');
              const matches = [...content.matchAll(searchRegex)];
              
              if (matches.length > 0) {
                // Get context for each match
                const matchesWithContext = matches.map(match => {
                  const index = match.index || 0;
                  const startContext = Math.max(0, index - 40);
                  const endContext = Math.min(content.length, index + match[0].length + 40);
                  
                  return {
                    match: match[0],
                    line: content.substring(0, index).split('\n').length,
                    context: content.substring(startContext, endContext)
                      .replace(/\n/g, ' ')
                      .trim()
                  };
                });
                
                results.push({
                  file: fullPath,
                  matches: matchesWithContext.slice(0, 5), // Limit matches per file
                  totalMatches: matches.length
                });
              }
            } catch (error) {
              // Skip files that can't be read as text
              continue;
            }
          }
        }
        
        return results;
      };
      
      // Perform the search
      const searchResults = await searchFilesRecursive(searchPath);
      
      // Count total matches
      const totalMatches = searchResults.reduce((sum, file) => sum + file.totalMatches, 0);
      
      return {
        output: `Found ${totalMatches} matches in ${searchResults.length} files`,
        results: searchResults,
        pattern: pattern,
        totalMatches,
        searchPath,
        truncated: totalMatches > maxResults ? true : false
      };
    }, (error) => {
      return `Failed to search files: ${error.message}`;
    });
  }
};