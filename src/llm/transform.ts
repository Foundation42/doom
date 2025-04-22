// Transform text using task-specific LLM selection
import { createLLMProvider, LLMFn } from './llm-providers';
import { TaskType, getTaskLLM } from './adaptive-llm';
import { Logger } from '../types';

// Create a default logger for this module
const logger: Logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[debug] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.log(`[info] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[warn] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[error] ${message}`, ...args),
};

// Cache of LLM functions by provider/model
const llmCache: Map<string, LLMFn> = new Map();

/**
 * Enhanced transform function that selects an appropriate LLM based on task type
 * @param input The prompt to transform
 * @param taskType The type of task being performed (determines model selection)
 * @param debug Whether to enable debug logging
 * @returns The transformed output
 */
export async function transform(
  input: string, 
  taskType: TaskType = TaskType.COMPLEX_REASONING,
  debug: boolean = false
): Promise<string> {
  try {
    if (debug) {
      logger.debug(`Transform: Processing input of length ${input.length}`);
      logger.debug(`Transform: Task type: ${taskType}`);
    }
    
    // Get environment-specified provider and model (if any)
    const preferredProvider = process.env.LLM_PROVIDER;
    const maxModelSize = process.env.LLM_MAX_MODEL_SIZE 
      ? parseInt(process.env.LLM_MAX_MODEL_SIZE) 
      : undefined;
    
    if (debug && preferredProvider) {
      logger.debug(`Transform: Using preferred provider from environment: ${preferredProvider}`);
      if (maxModelSize) {
        logger.debug(`Transform: Max model size constraint: ${maxModelSize}GB`);
      }
    }
    
    // Get appropriate LLM for the task 
    const { llm, recommendation } = await getTaskLLM(
      taskType,
      createLLMProvider,
      preferredProvider,
      maxModelSize
    );
    
    if (debug) {
      logger.debug(`Transform: Selected model ${recommendation.model} from provider ${recommendation.provider}`);
      logger.debug(`Transform: Selection reason: ${recommendation.reason}`);
    }
    
    // Call the LLM with the input
    const result = await llm(input);
    
    if (debug) {
      logger.debug(`Transform: Received response of length ${result.length}`);
    }
    
    return result;
  } catch (error) {
    logger.error(`Transform error: ${error}`);
    throw error;
  }
}