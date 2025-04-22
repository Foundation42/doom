// This file contains common models for each LLM provider

export type Capability = 
  | 'text generation'
  | 'reasoning'
  | 'vision'
  | 'code generation'
  | 'low latency'
  | 'complex tasks'
  | 'chat'
  | 'roleplay';

export type ProviderName = 
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'google'
  | 'deepseek'
  | 'ollama';

export interface ProviderModelInfo {
  name: string;
  description: string;
  capabilities: Capability[];
  sizeMB?: number; // Optional size in MB, useful for Ollama models
  maxInputTokens?: number; // Maximum input tokens supported by this model
  maxOutputTokens?: number; // Maximum output tokens supported by this model
}

export const providerModels: Record<ProviderName, ProviderModelInfo[]> = {
  openai: [
    { 
      name: 'gpt-4.1', 
      description: 'OpenAI\'s multimodal model designed for complex tasks and coding',
      capabilities: ['code generation', 'text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'gpt-4o', 
      description: 'OpenAI\'s multimodal model with vision and advanced reasoning',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'gpt-4-turbo', 
      description: 'Fast, capable version of GPT-4 with large context window',
      capabilities: ['text generation', 'reasoning'] 
    },
    { 
      name: 'gpt-4', 
      description: 'OpenAI\'s most capable model for complex tasks',
      capabilities: ['text generation', 'reasoning'] 
    },
    { 
      name: 'gpt-3.5-turbo', 
      description: 'Efficient model that balances capability and speed',
      capabilities: ['text generation'] 
    }
  ],
  
  anthropic: [
    { 
      name: 'claude-3-opus-20240229', 
      description: 'Anthropic\'s most capable model with excellent reasoning',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'claude-3-sonnet-20240229', 
      description: 'Well-balanced model for most tasks',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'claude-3-haiku-20240307', 
      description: 'Fast, efficient model for routine tasks',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'claude-instant-1.2', 
      description: 'Legacy fast model for simpler tasks',
      capabilities: ['text generation'] 
    }
  ],
  
  mistral: [
    { 
      name: 'mistral-large-latest', 
      description: 'Mistral\'s most capable model',
      capabilities: ['text generation', 'reasoning'] 
    },
    { 
      name: 'mistral-medium-latest', 
      description: 'Mid-tier model with good capability/efficiency balance',
      capabilities: ['text generation', 'reasoning'] 
    },
    { 
      name: 'mistral-small-latest', 
      description: 'Fast, efficient model for routine tasks',
      capabilities: ['text generation'] 
    },
    { 
      name: 'open-mistral-7b', 
      description: 'Open-source 7B parameter model',
      capabilities: ['text generation'] 
    }
  ],
  
  google: [
    { 
      name: 'gemini-1.5-pro', 
      description: 'Google\'s most capable model with multimodal capabilities',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'gemini-1.5-flash', 
      description: 'Fast, efficient model for routine tasks',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    },
    { 
      name: 'gemini-2.5-pro-preview-03-25', 
      description: 'Advanced model for deep code generation, review and reasoning',
      capabilities: ['text generation', 'reasoning', 'vision'] 
    }
  ],
  
  deepseek: [
    { 
      name: 'deepseek-chat', 
      description: 'The general chat model from DeepSeek',
      capabilities: ['text generation', 'reasoning'] 
    },
    { 
      name: 'deepseek-coder', 
      description: 'Model specialized for code generation',
      capabilities: ['code generation', 'reasoning'] 
    }
  ],
  
  ollama: [
    { 
      name: 'gemma3:1b', 
      description: 'Fast, lightweight model for quick responses',
      capabilities: ['text generation', 'low latency'],
      sizeMB: 815
    },
    { 
      name: 'gemma3:12b', 
      description: 'More capable model for complex generations',
      capabilities: ['text generation', 'reasoning'],
      sizeMB: 8192 // 8.1GB
    },
    { 
      name: 'phi4-mini', 
      description: 'Compact but powerful general-purpose model',
      capabilities: ['text generation', 'reasoning'],
      sizeMB: 2867 // 2.8GB
    },
    { 
      name: 'phi4', 
      description: 'Microsoft\'s capable general-purpose model',
      capabilities: ['text generation', 'reasoning'],
      sizeMB: 9319 // 9.1GB
    },
    { 
      name: 'deepseek-coder:1.3b', 
      description: 'Fast, lightweight model for code generation',
      capabilities: ['code generation', 'low latency'],
      sizeMB: 776
    },
    { 
      name: 'deepseek-r1:7b', 
      description: 'Mid-sized balanced general-purpose model',
      capabilities: ['text generation', 'reasoning'],
      sizeMB: 4813 // 4.7GB
    },
    { 
      name: 'deepseek-r1:32b', 
      description: 'Large, sophisticated model for complex tasks',
      capabilities: ['text generation', 'reasoning', 'complex tasks'],
      sizeMB: 19456 // 19GB
    },
    { 
      name: 'llama3.2:3b', 
      description: 'Compact general-purpose model',
      capabilities: ['text generation'],
      sizeMB: 2048 // 2.0GB
    }
  ]
};