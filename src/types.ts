/**
 * Represents a chat message.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Represents a pure chat message (no tool calls).
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/**
 * Represents a tool message.
 */
export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/**
 * Represents a tool call in an assistant message
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  parentCallId?: string; // Track nested call hierarchy
}

/**
 * A sub-task instruction for orchestration.
 */
export interface SubTask {
  /** Name of the tool to invoke. */
  toolName: string;
  /** Arguments for the tool. */
  args: any;
}

/**
 * Result returned by a tool function.
 */
export interface ToolResult {
  /** Output text to send back to the model. */
  output: string;
  /** Optional sub-tasks to execute sequentially. */
  subTasks?: SubTask[];
  /** Optional error message if the tool execution failed. */
  error?: string;
  /** Optional data payload returned by the tool. */
  [key: string]: any;
}

/**
 * Defines a callable tool.
 */
export interface Tool {
  /** Unique name of the tool (matches function_call.name). */
  name: string;
  /** Description for the model. */
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
  /** Actual implementation to run. */
  func: (args: any) => Promise<ToolResult>;
}

/**
 * Logger interface for injecting custom logging
 */
export interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

/**
 * Configuration for parallel task execution
 */
export interface ParallelConfig {
  /** Whether to execute subtasks in parallel (default: false) */
  enabled: boolean;
  /** Maximum number of concurrent subtasks (default: 4) */
  maxConcurrent?: number;
  /** Whether to run nested subtasks in parallel (default: false) */
  includeNested?: boolean;
  /** Maximum depth level to execute in parallel (default: 1, only root level) */
  maxDepth?: number;
  /** Whether to continue execution if a subtask fails (default: false) */
  continueOnError?: boolean;
  /** Whether to preserve original order in results regardless of completion time (default: true) */
  preserveOrder?: boolean;
}

/**
 * Tool execution event with details
 */
export interface ToolExecutionEvent {
  toolName: string;
  args: any;
  result?: string;
  executionTime?: number;
  isSubtask?: boolean;
  parentToolName?: string;
  error?: string;
}

/**
 * Options for running the chat, including cancellation and retry settings.
 */
export interface RunOptions {
  /** OpenAI model name (defaults to 'gpt-4o-mini'). */
  modelName?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum number of retry attempts for transient errors. */
  maxRetries?: number;
  /** Base delay (ms) before retry, doubled each attempt. */
  retryDelayMs?: number;
  /** AbortSignal to cancel the operation. */
  signal?: AbortSignal;
  /** Maximum time (ms) to wait for the API response before abort. */
  timeoutMs?: number;
  /** Custom logger implementation. */
  logger?: Logger;
  /** Configuration for parallel task execution */
  parallel?: ParallelConfig | boolean;
  /** Callback for visualizing tool execution */
  onToolExecution?: (event: ToolExecutionEvent) => void;
  /** Show tool calls in output (defaults to false) */
  showToolCalls?: boolean;
}