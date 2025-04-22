import dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../types';

// Create a default logger for this module
const logger: Logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[debug] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.log(`[info] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[warn] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[error] ${message}`, ...args),
};

// Load environment variables from both home directory and project directory
dotenv.config(); // Project .env
dotenv.config({ path: path.join(os.homedir(), '.env') }); // Home directory .env

// Type for LLM function
export type LLMFn = (prompt: string) => Promise<string>;

// Interface for provider-specific options
interface LLMProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number; // Timeout in milliseconds
}

// Custom error classes for better error handling
export class LLMProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class LLMApiError extends LLMProviderError {
  statusCode?: number;
  
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'LLMApiError';
    this.statusCode = statusCode;
  }
}

export class LLMConfigError extends LLMProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

export class LLMTimeoutError extends LLMProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMTimeoutError';
  }
}

// API response type definitions
export interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

export interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface GoogleGenerateContentResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    thoughtsTokenCount?: number;
  };
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface OllamaResponse {
  response: string;
}

/**
 * Helper function to make API calls to LLM providers
 * Handles common functionality like fetch, timeout, and error handling
 */
async function callLLMApi<TResponse>(
  url: string, 
  headers: Record<string, string>, 
  body: Record<string, unknown>, // Use unknown instead of any for better type safety
  providerName: string,
  timeoutMs = 300000 // 5 minutes as default to support long-running models
): Promise<TResponse> {
  logger.debug(`Making ${providerName} API request to ${url}`);
  
  // Set up timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    throw new LLMTimeoutError(`${providerName} API request timed out after ${timeoutMs}ms`);
  }, timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`${providerName} API error (${response.status}): ${errorText}`);
      throw new LLMApiError(`${providerName} API error: ${errorText}`, response.status);
    }
    
    const data = await response.json();
    return data as TResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof LLMProviderError) {
      throw error; // Re-throw our custom errors
    }
    
    // Handle fetch errors or other unexpected errors
    logger.error(`Error in ${providerName} API request:`, error);
    throw new LLMApiError(`Error in ${providerName} API request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates an OpenAI LLM provider
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to OpenAI
 */
export async function createOpenAIProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LLMConfigError('OpenAI API key not found');
  
  const model = options.model || 'gpt-4.1';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 32768; // Increased to maximum allowed for most models
  const timeoutMs = options.timeoutMs ?? 300000; // Increased to 5 minutes
  
  logger.debug(`Creating OpenAI provider with model: ${model}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`OpenAI request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      
      // OpenAI models have a max of 16384 tokens
      let effectiveMaxTokens = Math.min(maxTokens, 16384);
      logger.debug(`Using max_tokens=${effectiveMaxTokens} for OpenAI model ${model}`);
      
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: effectiveMaxTokens
      };
      
      const data = await callLLMApi<OpenAIChatCompletionResponse>(
        'https://api.openai.com/v1/chat/completions',
        headers,
        body,
        'OpenAI',
        timeoutMs
      );
      
      // Validate response format
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new LLMApiError('Invalid response format from OpenAI API: Missing choices or content');
      }
      
      const result = data.choices[0].message.content;
      logger.debug(`OpenAI response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      // No need for additional error handling here as callLLMApi already handles errors
      throw error;
    }
  };
}

/**
 * Creates an Anthropic (Claude) LLM provider
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to Anthropic
 */
export async function createAnthropicProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMConfigError('Anthropic API key not found');
  
  const model = options.model || 'claude-3-haiku-20240307';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 32768; // Increased to maximum allowed for Claude models
  const timeoutMs = options.timeoutMs ?? 300000; // Increased to 5 minutes
  
  logger.debug(`Creating Anthropic provider with model: ${model}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`Anthropic request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
      
      // Claude models have a max output token limit of 4096
      let effectiveMaxTokens = Math.min(maxTokens, 4096);
      logger.debug(`Using max_tokens=${effectiveMaxTokens} for Anthropic model ${model}`);
      
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: effectiveMaxTokens
      };
      
      const data = await callLLMApi<AnthropicResponse>(
        'https://api.anthropic.com/v1/messages',
        headers,
        body,
        'Anthropic',
        timeoutMs
      );
      
      // Validate response format
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new LLMApiError('Invalid response format from Anthropic API: Missing content or text');
      }
      
      const result = data.content[0].text;
      logger.debug(`Anthropic response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Creates a Mistral LLM provider
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to Mistral
 */
export async function createMistralProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new LLMConfigError('Mistral API key not found');
  
  const model = options.model || 'mistral-large-latest';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 16384; // Increased for large code files
  const timeoutMs = options.timeoutMs ?? 120000;
  
  logger.debug(`Creating Mistral provider with model: ${model}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`Mistral request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      };
      
      const data = await callLLMApi<MistralResponse>(
        'https://api.mistral.ai/v1/chat/completions',
        headers,
        body,
        'Mistral',
        timeoutMs
      );
      
      // Validate response format
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new LLMApiError('Invalid response format from Mistral API: Missing choices or content');
      }
      
      const result = data.choices[0].message.content;
      logger.debug(`Mistral response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Creates a Google (Gemini) LLM provider
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to Google's Gemini
 */
export async function createGoogleProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new LLMConfigError('Google API key not found');
  
  const model = options.model || 'gemini-1.5-pro';
  const temperature = options.temperature ?? 0.7;
  
  // Use high token limits, especially for preview models which use tokens for thinking
  const maxTokens = options.maxTokens ?? (model.includes('preview') ? 32768 : 16384);
  
  // Use longer timeouts for preview models which need more thinking time
  const timeoutMs = options.timeoutMs ?? (model.includes('preview') ? 300000 : 120000); // 5 minutes for preview models
  
  logger.debug(`Creating Google provider with model: ${model}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`Google request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        },
        // Adding explicit safety settings to ensure we don't get blocked
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
      };
      
      const data = await callLLMApi<GoogleGenerateContentResponse>(
        url,
        headers,
        body,
        'Google',
        timeoutMs
      );
      
      // Preview models sometimes return partial or empty responses - log all responses
      if (model.includes('preview')) {
        logger.debug(`Google API response for ${model}: ${JSON.stringify(data)}`);
      }
      
      // Check for preview model inconsistent response (only usageMetadata)
      if (data.usageMetadata && (!data.candidates || data.candidates.length === 0)) {
        // This is a common issue with preview models - retry automatically
        logger.warn(`Google API for ${model} returned only usageMetadata without content. This is common with preview models.`);
        
        // Allow caller to handle the error
        throw new LLMApiError(`Google ${model} API returned empty response (only usageMetadata). This model may be unstable - try the request again or use a stable model like gemini-1.5-pro.`);
      }
      
      // Standard validation
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        // Log the full response for debugging
        logger.error(`Invalid response format from Google API: ${JSON.stringify(data)}`);
        throw new LLMApiError('Invalid response format from Google API: Missing candidates or content');
      }
      
      if (!data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        logger.error(`Invalid content format from Google API: ${JSON.stringify(data.candidates[0].content)}`);
        throw new LLMApiError('Invalid content format from Google API: Missing parts');
      }
      
      let result = data.candidates[0].content.parts[0].text;
      
      // For thinking models (especially preview models), filter out any chain-of-thought prefixes
      if (model.includes('preview') && data.usageMetadata?.thoughtsTokenCount) {
        logger.debug(`Detected thinking model with ${data.usageMetadata.thoughtsTokenCount} thought tokens`);
        
        // Common patterns in thinking model outputs
        const thinkingPrefixes = [
          /^Okay, (here|let me|I'll)/i,
          /^I'll (answer|respond)/i,
          /^(Let me|I will) (think|consider)/i,
          /^(Sure|Alright|Now)/i
        ];
        
        // Check if result starts with a thinking prefix
        const originalLength = result.length;
        for (const pattern of thinkingPrefixes) {
          if (pattern.test(result)) {
            // Try to find where the actual content starts after the prefix
            const lines = result.split('\n');
            if (lines.length > 1) {
              // Skip the first line with the thinking prefix
              result = lines.slice(1).join('\n').trim();
              logger.debug(`Removed thinking prefix from response (${originalLength} → ${result.length} chars)`);
              break;
            }
          }
        }
      }
      
      logger.debug(`Google response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Creates a DeepSeek LLM provider
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to DeepSeek
 */
export async function createDeepSeekProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new LLMConfigError('DeepSeek API key not found');
  
  const model = options.model || 'deepseek-chat';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 16384; // Increased for large code files
  const timeoutMs = options.timeoutMs ?? 120000;
  
  logger.debug(`Creating DeepSeek provider with model: ${model}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`DeepSeek request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      };
      
      const data = await callLLMApi<DeepSeekResponse>(
        'https://api.deepseek.com/v1/chat/completions',
        headers,
        body,
        'DeepSeek',
        timeoutMs
      );
      
      // Validate response format
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new LLMApiError('Invalid response format from DeepSeek API: Missing choices or content');
      }
      
      const result = data.choices[0].message.content;
      logger.debug(`DeepSeek response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Creates an Ollama LLM provider (for local model inference)
 * @param options - Configuration options for the provider
 * @returns An LLM function that sends prompts to Ollama
 */
export async function createOllamaProvider(options: LLMProviderOptions = {}): Promise<LLMFn> {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  
  // Default to gemma3:1b for fast operations, but allow override
  const model = options.model || 'gemma3:1b';
  const temperature = options.temperature ?? 0.7;
  const timeoutMs = options.timeoutMs ?? 120000;
  
  logger.debug(`Creating Ollama provider with model: ${model}, endpoint: ${endpoint}`);
  
  return async (prompt: string): Promise<string> => {
    logger.debug(`Ollama request to model: ${model}, prompt length: ${prompt.length} chars`);
    
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const body = {
        model,
        prompt,
        temperature,
        stream: false
      };
      
      const data = await callLLMApi<OllamaResponse>(
        `${endpoint}/api/generate`,
        headers,
        body,
        'Ollama',
        timeoutMs
      );
      
      // Validate response format
      if (!data || typeof data.response !== 'string') {
        throw new LLMApiError('Invalid response format from Ollama API: Missing response field');
      }
      
      const result = data.response;
      logger.debug(`Ollama response received, length: ${result.length} chars`);
      return result;
    } catch (error) {
      throw error;
    }
  };
}


/**
 * Factory function to create an LLM provider based on name or environment variables
 * @param provider - The provider name (optional, defaults to env or 'openai')
 * @param options - Configuration options for the provider
 * @returns A configured LLM function
 */
export async function createLLMProvider(
  provider?: string, 
  options: LLMProviderOptions = {}
): Promise<LLMFn> {
  // Use environment variable if provider not specified
  const providerName = provider || process.env.LLM_PROVIDER || 'openai';
  
  // If model not specified in options, check environment
  if (!options.model && process.env.LLM_MODEL) {
    options.model = process.env.LLM_MODEL;
  }
  
  logger.debug(`Creating LLM provider: ${providerName}, model: ${options.model ?? 'default'}`);
  
  try {
    let llmFn: LLMFn;
    
    switch (providerName.toLowerCase()) {
      case 'openai':
        llmFn = await createOpenAIProvider(options);
        break;
      case 'anthropic':
        llmFn = await createAnthropicProvider(options);
        break;
      case 'mistral':
        llmFn = await createMistralProvider(options);
        break;
      case 'google':
        llmFn = await createGoogleProvider(options);
        break;
      case 'deepseek':
        llmFn = await createDeepSeekProvider(options);
        break;
      case 'ollama':
        llmFn = await createOllamaProvider(options);
        break;
      default:
        throw new LLMConfigError(`Unknown LLM provider: ${providerName}`);
    }
    
    logger.debug(`Successfully created LLM provider: ${providerName}`);
    return llmFn;
  } catch (error) {
    // If it's already one of our custom errors, just rethrow it
    if (error instanceof LLMProviderError) {
      throw error;
    }
    
    // Otherwise, wrap it in a general provider error
    logger.error(`Failed to create LLM provider ${providerName}:`, error);
    throw new LLMProviderError(
      `Failed to create ${providerName} provider: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}