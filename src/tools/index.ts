/**
 * Standard library of reusable tools
 */
import { Tool, ToolResult } from '../types';
import { createHttpTools } from './http-tools';
import { createDataTools } from './data-tools';
import { createUtilityTools } from './utility-tools';
import { createFileTools } from './file-tools';
import { createAiTools } from './ai-tools';
import { createSystemTools } from './system-tools';
import { createTTSTools } from './tts-tools';
import { createLLMTools } from './llm-tools';

// Export all tool-related utilities
export * from './http-tools';
export * from './data-tools';
export * from './utility-tools';
export * from './file-tools';
export * from './ai-tools';
export * from './system-tools';
export * from './tts-tools';
export * from './llm-tools';

/**
 * Creates a standard library of useful tools
 * @returns An array of ready-to-use Tool instances
 */
export function createStandardTools(): Tool[] {
  return [
    ...createHttpTools(),
    ...createDataTools(),
    ...createUtilityTools(),
    ...createFileTools(),
    ...createAiTools(),
    ...createSystemTools(),
    ...createTTSTools(),
    ...createLLMTools()
  ];
}

/**
 * Utility to create a delay with an optional abort signal
 */
export async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new Error('Operation aborted');
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    
    const abortHandler = () => {
      clearTimeout(timeout);
      reject(new Error('Operation aborted'));
    };
    
    if (signal) {
      signal.addEventListener('abort', abortHandler);
      setTimeout(() => {
        signal.removeEventListener('abort', abortHandler);
      }, ms);
    }
  });
}

/**
 * Helper to safely handle errors and return structured ToolResults
 */
export async function safeToolExecution<T extends ToolResult>(
  executor: () => Promise<T | string>,
  errorHandler?: (error: Error) => string
): Promise<ToolResult> {
  try {
    const result = await executor();
    
    // Normalize result format
    if (typeof result === 'string') {
      return { output: result };
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const formattedMessage = errorHandler 
      ? errorHandler(error instanceof Error ? error : new Error(errorMessage))
      : `Error: ${errorMessage}`;
    
    return { 
      output: formattedMessage,
      error: errorMessage
    };
  }
}