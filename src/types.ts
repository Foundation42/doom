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
 * Represents a tool call in an assistant message
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
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
  func: (args: any) => Promise<string | ToolResult>;
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
}