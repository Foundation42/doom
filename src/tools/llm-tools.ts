/**
 * Advanced LLM tools using multiple model providers
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution, delay } from './index';
import { createLLMProvider } from '../llm/llm-providers';
import { transform } from '../llm/transform';
import { TaskType } from '../llm/adaptive-llm';

/**
 * Creates a set of advanced LLM tools
 * @returns An array of LLM-related tools
 */
export function createLLMTools(): Tool[] {
  return [
    multiProviderCompletionTool,
    adaptiveCompletionTool,
    transformTextTool,
    compareLLMResponsesTool,
    chainOfThoughtTool
  ];
}

/**
 * A tool that can use different LLM providers based on preference
 */
export const multiProviderCompletionTool: Tool = {
  name: 'multiProviderCompletion',
  description: 'Sends a prompt to a selected LLM provider (OpenAI, Anthropic, Google, etc.)',
  parameters: {
    type: 'object',
    properties: {
      prompt: { 
        type: 'string', 
        description: 'The prompt to send to the LLM' 
      },
      provider: { 
        type: 'string',
        enum: ['openai', 'anthropic', 'google', 'mistral', 'deepseek', 'ollama'],
        description: 'The LLM provider to use',
        default: 'openai'
      },
      model: {
        type: 'string',
        description: 'Specific model to use (if not specified, uses provider default)',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for generation (0.0-1.0)',
        default: 0.7
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens to generate',
        default: 2048
      }
    },
    required: ['prompt'],
    additionalProperties: false
  },
  func: async (args: { 
    prompt: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        prompt, 
        provider = 'openai',
        model,
        temperature = 0.7,
        maxTokens = 2048
      } = args;
      
      // Create options for the provider
      const options: Record<string, any> = {
        temperature,
        maxTokens
      };
      
      // Add model if specified
      if (model) {
        options.model = model;
      }
      
      try {
        // Get the LLM provider
        const llm = await createLLMProvider(provider, options);
        
        // Generate the response
        const startTime = Date.now();
        const response = await llm(prompt);
        const endTime = Date.now();
        
        return {
          output: response,
          metadata: {
            provider,
            model: model || 'default',
            temperature,
            maxTokens,
            promptLength: prompt.length,
            responseLength: response.length,
            timeMs: endTime - startTime
          }
        };
      } catch (error) {
        throw new Error(`Error from ${provider}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `LLM request failed: ${error.message}`;
    });
  }
};

/**
 * A tool that automatically selects an appropriate model based on the task
 */
export const adaptiveCompletionTool: Tool = {
  name: 'adaptiveCompletion',
  description: 'Automatically selects the most appropriate model for a specific task type',
  parameters: {
    type: 'object',
    properties: {
      prompt: { 
        type: 'string', 
        description: 'The prompt to send to the LLM' 
      },
      taskType: { 
        type: 'string',
        enum: [
          'quick_response', 
          'agent_creation', 
          'agent_combination', 
          'code_generation', 
          'complex_reasoning', 
          'conversation'
        ],
        description: 'The type of task to perform (determines model selection)',
        default: 'complex_reasoning'
      },
      preferredProvider: {
        type: 'string',
        enum: ['openai', 'anthropic', 'google', 'mistral', 'deepseek', 'ollama'],
        description: 'Preferred provider to use if available',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for generation (0.0-1.0)',
        default: 0.7
      }
    },
    required: ['prompt'],
    additionalProperties: false
  },
  func: async (args: { 
    prompt: string;
    taskType?: string;
    preferredProvider?: string; 
    temperature?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        prompt, 
        taskType = 'complex_reasoning',
        preferredProvider,
        temperature = 0.7
      } = args;
      
      try {
        // Map string taskType to enum
        const taskEnum = taskType as TaskType;
        
        // Use the transform function with the appropriate task type
        const startTime = Date.now();
        const response = await transform(prompt, taskEnum, true); // Enable debug logging
        const endTime = Date.now();
        
        return {
          output: response,
          metadata: {
            taskType,
            preferredProvider: preferredProvider || 'auto',
            temperature,
            promptLength: prompt.length,
            responseLength: response.length,
            timeMs: endTime - startTime
          }
        };
      } catch (error) {
        throw new Error(`Error in adaptive completion: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Adaptive LLM request failed: ${error.message}`;
    });
  }
};

/**
 * A tool for transforming text using task-specific LLM selection
 */
export const transformTextTool: Tool = {
  name: 'transformText',
  description: 'Transforms text using a task-specific optimized LLM (summarization, extraction, etc.)',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to transform' 
      },
      transformation: { 
        type: 'string',
        enum: [
          'summarize', 
          'extract_key_points', 
          'simplify', 
          'elaborate', 
          'formalize',
          'creative_rewrite',
          'bulletize',
          'convert_to_markdown'
        ],
        description: 'The type of transformation to perform',
        default: 'summarize'
      },
      outputLength: {
        type: 'string',
        enum: ['very_short', 'short', 'medium', 'long'],
        description: 'Desired length of the output',
        default: 'medium'
      },
      temperature: {
        type: 'number',
        description: 'Temperature for generation (0.0-1.0)',
        default: 0.7
      }
    },
    required: ['text', 'transformation'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string;
    transformation: string;
    outputLength?: string;
    temperature?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        text, 
        transformation,
        outputLength = 'medium',
        temperature = 0.7
      } = args;
      
      // Map transformation to task type
      const taskTypeMap: Record<string, TaskType> = {
        summarize: TaskType.COMPLEX_REASONING,
        extract_key_points: TaskType.COMPLEX_REASONING,
        simplify: TaskType.QUICK_RESPONSE,
        elaborate: TaskType.COMPLEX_REASONING,
        formalize: TaskType.COMPLEX_REASONING,
        creative_rewrite: TaskType.AGENT_CREATION,
        bulletize: TaskType.QUICK_RESPONSE,
        convert_to_markdown: TaskType.CODE_GENERATION
      };
      
      const taskType = taskTypeMap[transformation] || TaskType.COMPLEX_REASONING;
      
      // Map outputLength to word count guidance
      const lengthMap: Record<string, string> = {
        very_short: '1-2 sentences or about 20-30 words',
        short: '3-5 sentences or about 50-100 words',
        medium: 'about 150-250 words',
        long: 'comprehensive, about 300-500 words'
      };
      
      const lengthGuidance = lengthMap[outputLength];
      
      // Create specific prompts based on transformation type
      let prompt: string;
      
      switch (transformation) {
        case 'summarize':
          prompt = `Summarize the following text in ${lengthGuidance}:\n\n${text}`;
          break;
        case 'extract_key_points':
          prompt = `Extract the key points from the following text as a bulleted list. Use about ${lengthGuidance}:\n\n${text}`;
          break;
        case 'simplify':
          prompt = `Rewrite the following text in simpler, easier to understand language. Use ${lengthGuidance}:\n\n${text}`;
          break;
        case 'elaborate':
          prompt = `Elaborate on the following text with more details and explanation. Make it ${lengthGuidance}:\n\n${text}`;
          break;
        case 'formalize':
          prompt = `Rewrite the following text in a more formal, professional tone. Keep it ${lengthGuidance}:\n\n${text}`;
          break;
        case 'creative_rewrite':
          prompt = `Creatively rewrite the following text in an engaging and imaginative way. Make it ${lengthGuidance}:\n\n${text}`;
          break;
        case 'bulletize':
          prompt = `Convert the following text into a well-organized bulleted list. Use ${lengthGuidance}:\n\n${text}`;
          break;
        case 'convert_to_markdown':
          prompt = `Convert the following text to well-formatted Markdown, using appropriate headings, lists, emphasis, and other Markdown features:\n\n${text}`;
          break;
        default:
          prompt = `Transform the following text (${transformation}). Output should be ${lengthGuidance}:\n\n${text}`;
      }
      
      try {
        // Use transform function with the appropriate task type
        const startTime = Date.now();
        const response = await transform(prompt, taskType);
        const endTime = Date.now();
        
        return {
          output: response,
          metadata: {
            transformation,
            outputLength,
            taskType: taskType.toString(),
            inputLength: text.length,
            outputTextLength: response.length,
            timeMs: endTime - startTime
          }
        };
      } catch (error) {
        throw new Error(`Text transformation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Text transformation failed: ${error.message}`;
    });
  }
};

/**
 * A tool that compares responses from different LLM providers
 */
export const compareLLMResponsesTool: Tool = {
  name: 'compareLLMResponses',
  description: 'Compares responses from multiple LLM providers for the same prompt',
  parameters: {
    type: 'object',
    properties: {
      prompt: { 
        type: 'string', 
        description: 'The prompt to send to multiple LLMs' 
      },
      providers: { 
        type: 'array',
        items: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'mistral', 'deepseek', 'ollama']
        },
        description: 'The LLM providers to compare (defaults to OpenAI, Anthropic, and Google)',
        default: ['openai', 'anthropic', 'google']
      },
      temperature: {
        type: 'number',
        description: 'Temperature for all LLMs (0.0-1.0)',
        default: 0.7
      },
      compareResponses: {
        type: 'boolean',
        description: 'Whether to generate a comparison of the responses',
        default: true
      }
    },
    required: ['prompt'],
    additionalProperties: false
  },
  func: async (args: { 
    prompt: string;
    providers?: string[];
    temperature?: number;
    compareResponses?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        prompt, 
        providers = ['openai', 'anthropic', 'google'],
        temperature = 0.7,
        compareResponses = true
      } = args;
      
      // Validate we have API keys for the requested providers
      const validProviders = providers.filter(provider => {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        return process.env[envKey] !== undefined;
      });
      
      if (validProviders.length === 0) {
        return {
          output: `No valid API keys found for the requested providers: ${providers.join(', ')}`,
          error: 'Missing API keys'
        };
      }
      
      // Create an LLM for each provider
      const llms = await Promise.all(
        validProviders.map(async (provider) => {
          try {
            return {
              provider,
              llm: await createLLMProvider(provider, { temperature })
            };
          } catch (error) {
            return {
              provider,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );
      
      // Get responses from each LLM
      const responses: Record<string, { response?: string; error?: string; timeMs?: number }> = {};
      
      await Promise.all(
        llms.map(async (providerInfo) => {
          // Skip providers that failed to initialize
          if ('error' in providerInfo) {
            responses[providerInfo.provider] = { error: providerInfo.error };
            return;
          }
          
          try {
            const startTime = Date.now();
            const response = await providerInfo.llm(prompt);
            const endTime = Date.now();
            
            responses[providerInfo.provider] = { 
              response, 
              timeMs: endTime - startTime 
            };
          } catch (error) {
            responses[providerInfo.provider] = { 
              error: error instanceof Error ? error.message : String(error) 
            };
          }
        })
      );
      
      // Generate a comparison if requested
      let comparison = '';
      if (compareResponses && Object.values(responses).some(r => 'response' in r)) {
        // Use OpenAI for comparison if available, otherwise use the first available provider
        const comparisonProvider = 'openai' in responses && 'response' in responses.openai 
          ? 'openai'
          : Object.keys(responses).find(p => 'response' in responses[p]);
        
        if (comparisonProvider) {
          try {
            const comparisonLLM = await createLLMProvider('openai', { temperature: 0.3 });
            
            const comparisonPrompt = `Compare and contrast the following LLM responses to this prompt:
            
PROMPT: ${prompt}

${Object.entries(responses)
  .filter(([_, value]) => 'response' in value)
  .map(([provider, value]) => `${provider.toUpperCase()} RESPONSE:
${value.response}
---`)
  .join('\n\n')}

Please provide a thoughtful analysis of these responses, including:
1. Which response is most accurate and helpful
2. Strengths and weaknesses of each response
3. Unique insights or information provided by specific models
4. Which model would you recommend for this specific type of query and why`;
            
            comparison = await comparisonLLM(comparisonPrompt);
          } catch (error) {
            comparison = `Error generating comparison: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }
      
      // Format the output
      const outputParts = [
        `Compared ${Object.keys(responses).length} LLM providers' responses:`,
        ...Object.entries(responses).map(([provider, data]) => {
          if ('error' in data) {
            return `\n${provider.toUpperCase()}: ERROR - ${data.error}`;
          } else {
            return `\n${provider.toUpperCase()} (${data.timeMs}ms):\n${data.response}`;
          }
        })
      ];
      
      if (comparison) {
        outputParts.push('\n\nCOMPARISON ANALYSIS:\n' + comparison);
      }
      
      return {
        output: outputParts.join('\n'),
        responses,
        comparison,
        providers: validProviders
      };
    }, (error) => {
      return `LLM comparison failed: ${error.message}`;
    });
  }
};

/**
 * A tool that uses chain-of-thought reasoning
 */
export const chainOfThoughtTool: Tool = {
  name: 'chainOfThought',
  description: 'Solves complex problems using step-by-step chain-of-thought reasoning',
  parameters: {
    type: 'object',
    properties: {
      problem: { 
        type: 'string', 
        description: 'The problem to solve or question to answer' 
      },
      domainKnowledge: { 
        type: 'string',
        description: 'Optional domain-specific knowledge or context to consider',
      },
      numSteps: {
        type: 'number',
        description: 'Suggested number of reasoning steps (approximate)',
        default: 3
      },
      includeSteps: {
        type: 'boolean',
        description: 'Whether to include the reasoning steps in the output',
        default: true
      },
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic', 'google', 'mistral', 'deepseek', 'ollama'],
        description: 'The LLM provider to use (defaults to the best available reasoning model)',
      }
    },
    required: ['problem'],
    additionalProperties: false
  },
  func: async (args: { 
    problem: string;
    domainKnowledge?: string;
    numSteps?: number;
    includeSteps?: boolean;
    provider?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        problem, 
        domainKnowledge = '',
        numSteps = 3,
        includeSteps = true,
        provider
      } = args;
      
      // Construct the Chain of Thought prompt
      const cotPrompt = `Problem: ${problem}
${domainKnowledge ? `\nContext/Domain Knowledge: ${domainKnowledge}` : ''}

Please solve this problem using a step-by-step chain-of-thought approach. Use approximately ${numSteps} logical steps to reach your conclusion.

Let's solve this systematically:

Step 1:`;
      
      // Use the complex reasoning task type for better model selection
      const taskType = TaskType.COMPLEX_REASONING;
      
      try {
        // Either use specified provider or let the adaptive system choose
        let response: string;
        let actualProvider: string;
        
        if (provider) {
          const llm = await createLLMProvider(provider, { temperature: 0.3 });
          response = await llm(cotPrompt);
          actualProvider = provider;
        } else {
          response = await transform(cotPrompt, taskType);
          actualProvider = 'adaptive';
        }
        
        // Extract the conclusion/answer if steps are not requested
        let finalAnswer = response;
        if (!includeSteps) {
          // Try to extract just the conclusion
          const conclusionPatterns = [
            /Conclusion:?\s*([\s\S]+)$/i,
            /Final Answer:?\s*([\s\S]+)$/i,
            /Therefore,?\s*([\s\S]+)$/i,
            /Thus,?\s*([\s\S]+)$/i,
            /In summary,?\s*([\s\S]+)$/i,
            /The answer is:?\s*([\s\S]+)$/i
          ];
          
          for (const pattern of conclusionPatterns) {
            const match = response.match(pattern);
            if (match && match[1]) {
              finalAnswer = match[1].trim();
              break;
            }
          }
          
          // If no conclusion format was found, just take the last paragraph
          if (finalAnswer === response) {
            const paragraphs = response.split('\n\n');
            if (paragraphs.length > 1) {
              finalAnswer = paragraphs[paragraphs.length - 1].trim();
            }
          }
        }
        
        return {
          output: includeSteps ? response : finalAnswer,
          fullResponse: response,
          provider: actualProvider,
          problem,
          includesReasoning: includeSteps
        };
      } catch (error) {
        throw new Error(`Chain of thought reasoning error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Chain of thought reasoning failed: ${error.message}`;
    });
  }
};