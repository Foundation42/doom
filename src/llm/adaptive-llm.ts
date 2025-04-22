import { LLMFn } from "./llm-providers";
import { providerModels, ProviderName, Capability, ProviderModelInfo } from "./provider-models";

type ProviderNameString = string & keyof typeof providerModels;

interface ModelRecommendation {
  provider: ProviderNameString;
  model: string;
  reason: string;
}

// Define task types for model selection
export enum TaskType {
  QUICK_RESPONSE = "quick_response",
  AGENT_CREATION = "agent_creation",
  AGENT_COMBINATION = "agent_combination",
  CODE_GENERATION = "code_generation",
  COMPLEX_REASONING = "complex_reasoning",
  CONVERSATION = "conversation"
}

// Function to recommend an appropriate model based on task
export function recommendModel(
  taskType: TaskType,
  preferredProvider?: ProviderNameString,
  maxModelSize?: number // in GB
): ModelRecommendation {
  // Default provider preference order
  const providerOrder = preferredProvider 
    ? [preferredProvider] 
    : ['ollama', 'google', 'openai', 'anthropic', 'mistral', 'deepseek'] as ProviderName[];
  
  // Model selection criteria based on task type
  let requiredCapabilities: Capability[] = [];
  let prefersFast = false;
  
  switch (taskType) {
    case TaskType.QUICK_RESPONSE:
      // Prefer gemma3:1b for quick, simple tasks
      if (preferredProvider === 'ollama') 
        return { provider: 'ollama', model: 'gemma3:1b', reason: 'Fast, lightweight model ideal for quick responses' };
      requiredCapabilities = ['text generation'];
      prefersFast = true;
      break;
    case TaskType.AGENT_CREATION:
      // Prefer phi4 or gemma3:12b for agent creation
      if (preferredProvider === 'ollama') {
        // Check if phi4 is available
        return { provider: 'ollama', model: 'phi4', reason: 'Excellent creative model for agent personality generation' };
      }
      requiredCapabilities = ['text generation'];
      break;
    case TaskType.AGENT_COMBINATION:
      // Prefer gemma3:12b for creative generation
      if (preferredProvider === 'ollama') 
        return { provider: 'ollama', model: 'gemma3:12b', reason: 'Well-rounded model with good reasoning for agent combination' };
      requiredCapabilities = ['text generation', 'reasoning'];
      break;
    case TaskType.CODE_GENERATION:
      // Prefer phi4 for coding tasks
      if (preferredProvider === 'ollama') 
        return { provider: 'ollama', model: 'phi4', reason: 'Best local model for coding tasks' };
      requiredCapabilities = ['code generation'];
      break;
    case TaskType.COMPLEX_REASONING:
      // Use gemma3:12b for complex reasoning
      if (preferredProvider === 'ollama') 
        return { provider: 'ollama', model: 'gemma3:12b', reason: 'Good balance of reasoning capability and efficiency' };
      requiredCapabilities = ['reasoning'];
      break;
    case TaskType.CONVERSATION:
      // Use a model good at conversation and roleplay for agent chat
      if (preferredProvider === 'ollama') 
        return { provider: 'ollama', model: 'gemma3:12b', reason: 'Good balance of context handling and personality consistency for conversation' };
      requiredCapabilities = ['text generation', 'chat', 'roleplay'];
      break;
    default:
      requiredCapabilities = ['text generation'];
  }

  // Helper to extract model size from description
  const extractModelSize = (model: ProviderModelInfo): number => {
    if (model.sizeMB !== undefined) {
      return model.sizeMB / 1024; // Convert MB to GB
    }
    // Fallback to parsing description if sizeMB is not available
    const match = model.description.match(/\((\d+\.?\d*)GB\)/);
    return match ? parseFloat(match[1]) : 100; // Default to large if unknown
  };

  // Check each provider in order of preference
  for (const provider of providerOrder) {
    const models = providerModels[provider as ProviderName];
    if (!models) continue;
    
    // Filter models based on capabilities and size
    const suitableModels = models.filter((model: ProviderModelInfo) => {
      const hasRequiredCapabilities = requiredCapabilities.every(cap => 
        model.capabilities.includes(cap)
      );
      
      // Check size constraints if provided
      const modelSize = extractModelSize(model);
      const meetsSizeConstraint = maxModelSize ? modelSize <= maxModelSize : true;
      
      return hasRequiredCapabilities && meetsSizeConstraint;
    });
    
    if (suitableModels.length > 0) {
      // Sort by size/capability preference
      suitableModels.sort((a: ProviderModelInfo, b: ProviderModelInfo) => {
        if (prefersFast) {
          // For quick tasks, prefer models with 'low latency' capability
          const aHasLowLatency = a.capabilities.includes('low latency');
          const bHasLowLatency = b.capabilities.includes('low latency');
          
          if (aHasLowLatency && !bHasLowLatency) return -1;
          if (!aHasLowLatency && bHasLowLatency) return 1;
          
          // If both have same latency profile, prefer smaller models
          return extractModelSize(a) - extractModelSize(b);
        } else {
          // For complex tasks, prefer larger models (more capable)
          return extractModelSize(b) - extractModelSize(a);
        }
      });
      
      // Return the best match
      const bestModel = suitableModels[0];
      return {
        provider,
        model: bestModel.name,
        reason: `Selected for ${taskType}, based on capabilities: ${bestModel.capabilities.join(', ')}`
      };
    }
  }
  
  // Fallback recommendation
  return {
    provider: 'ollama' as ProviderName,
    model: 'gemma3:1b', // Default fallback
    reason: 'Fallback model when no suitable model found for the task'
  };
}

// Cache to store LLM instances
const llmCache: Map<string, LLMFn> = new Map();

// Function to get an appropriate LLM for a task
export async function getTaskLLM(
  task: TaskType,
  createLLMFn: (provider: string, options: Record<string, unknown>) => Promise<LLMFn>,
  currentProvider?: string,
  maxModelSize?: number
): Promise<{ llm: LLMFn, recommendation: ModelRecommendation }> {
  // Get recommendation
  const recommendation = recommendModel(task, currentProvider as ProviderNameString, maxModelSize);
  
  // Create cache key
  const cacheKey = `${recommendation.provider}:${recommendation.model}`;
  
  // Check if we already have this LLM instantiated
  if (!llmCache.has(cacheKey)) {
    // Create new LLM instance and cache it
    const llm = await createLLMFn(recommendation.provider, { model: recommendation.model });
    llmCache.set(cacheKey, llm);
  }
  
  return { 
    llm: llmCache.get(cacheKey)!,
    recommendation
  };
}