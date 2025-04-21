import fetch, { Response } from 'node-fetch';
import { AbortController } from 'abort-controller';
import { Message, Tool, RunOptions, SubTask, ToolResult, Logger, ParallelConfig } from './types';
import { TextDecoder } from 'util';
import { Readable } from 'stream';

// Default console-based logger
const defaultLogger: Logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[debug] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.log(`[info] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[warn] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[error] ${message}`, ...args),
};

// Compatible AbortSignal type
type NodeAbortSignal = Pick<AbortSignal, 'aborted' | 'addEventListener' | 'removeEventListener'>;

/**
 * Runs a chat session with OpenAI's tool-calling model, handling sub-tasks via tool calls.
 * Supports cancellation, timeouts, and retry logic.
 * @param history  Initial chat history (system/user/assistant messages).
 * @param tools    Array of Tool definitions.
 * @param options  RunOptions for model, retry, and cancellation.
 * @returns Final assistant message (after all tools are run).
 */
export async function runChatWithTools(
  history: Message[],
  tools: Tool[],
  options: RunOptions = {}
): Promise<string> {
  const { signal } = options;
  const logger = options.logger || defaultLogger;
  const messages: Message[] = [...history];
  
  // Create a map for faster tool lookup
  const toolMap = new Map<string, Tool>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }
  
  const apiTools = tools.map(({ name, description, parameters }) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters,
    },
    strict: true
  }));

  // Pre-abort check
  if (signal?.aborted) throw new Error('Aborted');
  const onAbort = () => { };
  signal?.addEventListener('abort', onAbort);

  try {
    while (true) {
      const result = await chatCompletion(messages, apiTools, options);

      // If model requested tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        logger.info(`Received ${result.toolCalls.length} tool calls from LLM`);

        // Process each tool call
        for (const { name, arguments: rawArgs } of result.toolCalls) {
          logger.debug(`Processing tool call: ${name} with args: ${rawArgs}`);

          const tool = toolMap.get(name);
          if (!tool) throw new Error(`Tool ${name} not found`);

          // Parse args and execute the tool
          const args = safeParseArgs(rawArgs, logger) || {};

          try {
            const result = await tool.func(args);
            
            // Standardize output to be a ToolResult
            const toolResult: ToolResult = result;

            // Append tool call to conversation
            const callId = `call_${Math.random().toString(36).substring(2, 9)}`;
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: callId,
                type: 'function',
                function: { name, arguments: rawArgs }
              }]
            });

            messages.push({
              role: 'tool',
              content: toolResult.output,
              tool_call_id: callId
            });

            // Process any sub-tasks (with parallel execution if configured)
            if (toolResult.subTasks && toolResult.subTasks.length > 0) {
              logger.info(`Processing ${toolResult.subTasks.length} subtasks for ${name}`);
              await executeSubTasks(
                toolResult.subTasks, 
                toolMap, 
                messages, 
                { 
                  ...options, 
                  parentCallId: callId,
                  executionDepth: 0  // Root level for subtasks
                }
              );
            }
          } catch (error) {
            // Handle tool execution errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error executing tool ${name}: ${errorMessage}`);
            
            // Add error message as tool result
            const callId = `call_${Math.random().toString(36).substring(2, 9)}`;
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: callId,
                type: 'function',
                function: { name, arguments: rawArgs }
              }]
            });

            messages.push({
              role: 'tool',
              content: `Error: ${errorMessage}`,
              tool_call_id: callId
            });
          }
        }

        continue;
      }

      // Final assistant response
      messages.push({ role: 'assistant', content: result.content! });
      return result.content!;
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Executes a single subtask and adds its result to the conversation.
 * @returns The call ID used for this task
 */
async function executeOneSubTask(
  task: SubTask,
  toolMap: Map<string, Tool>,
  messages: Message[],
  options: RunOptions & { parentCallId?: string, executionDepth?: number }
): Promise<string | null> {
  const logger = options.logger || defaultLogger;
  const executionDepth = options.executionDepth || 0;
  
  logger.debug(`Executing subtask: ${task.toolName} with args:`, task.args);

  // Find the tool by name
  const tool = toolMap.get(task.toolName);
  if (!tool) {
    logger.error(`Available tools: ${Array.from(toolMap.keys()).join(', ')}`);
    throw new Error(`SubTask tool '${task.toolName}' not found`);
  }

  try {
    // Invoke the tool
    const toolResult = await tool.func(task.args);

    // Generate a unique call ID for this subtask
    const callId = `task_${Math.random().toString(36).substring(2, 9)}`;
    logger.debug(`Adding subtask result to conversation: ${callId}`);

    // Append invocation and output to conversation
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: callId,
        type: 'function',
        parentCallId: options.parentCallId, // Track parent call
        function: {
          name: task.toolName,
          arguments: task.args ? JSON.stringify(task.args) : "{}"
        }
      }]
    });

    messages.push({
      role: 'tool',
      content: toolResult.output,
      tool_call_id: callId
    });

    // Recursively handle nested subTasks
    if (toolResult.subTasks && toolResult.subTasks.length > 0) {
      logger.info(`Processing ${toolResult.subTasks.length} nested subtasks for ${task.toolName}`);
      await executeSubTasks(
        toolResult.subTasks, 
        toolMap, 
        messages, 
        { 
          ...options, 
          parentCallId: callId,
          executionDepth: executionDepth + 1
        }
      );
    }
    
    return callId;
  } catch (error) {
    // Handle tool execution errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing subtask ${task.toolName}: ${errorMessage}`);
    
    // Add error message as tool result
    const callId = `task_${Math.random().toString(36).substring(2, 9)}`;
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: callId,
        type: 'function',
        parentCallId: options.parentCallId,
        function: {
          name: task.toolName,
          arguments: task.args ? JSON.stringify(task.args) : "{}"
        }
      }]
    });

    messages.push({
      role: 'tool',
      content: `Error: ${errorMessage}`,
      tool_call_id: callId
    });
    
    return callId;
  }
}

/**
 * Executes an array of sub-tasks, feeding results back into the conversation.
 * Supports both sequential and parallel execution modes.
 */
async function executeSubTasks(
  subTasks: SubTask[],
  toolMap: Map<string, Tool>,
  messages: Message[],
  options: RunOptions & { parentCallId?: string, executionDepth?: number }
): Promise<void> {
  const logger = options.logger || defaultLogger;
  const executionDepth = options.executionDepth || 0;
  
  // Determine if we should run in parallel
  let parallelConfig: ParallelConfig = { enabled: false };
  
  if (typeof options.parallel === 'boolean') {
    parallelConfig = { enabled: options.parallel };
  } else if (options.parallel) {
    parallelConfig = options.parallel;
  }
  
  // Check if we should run in parallel at this depth level
  const shouldRunParallel = parallelConfig.enabled && 
    (executionDepth === 0 || parallelConfig.includeNested) &&
    (parallelConfig.maxDepth === undefined || executionDepth <= parallelConfig.maxDepth);
  
  if (shouldRunParallel) {
    logger.info(`Executing ${subTasks.length} subtasks in parallel mode`);
    
    // Determine batch size for concurrent tasks
    const maxConcurrent = parallelConfig.maxConcurrent || 4;
    
    // Process tasks in batches
    for (let i = 0; i < subTasks.length; i += maxConcurrent) {
      const batch = subTasks.slice(i, i + maxConcurrent);
      
      // Execute each task in this batch concurrently
      logger.debug(`Running parallel batch of ${batch.length} tasks`);
      const promises = batch.map(task => executeOneSubTask(task, toolMap, messages, {
        ...options,
        executionDepth
      }));
      
      // Wait for all tasks in this batch to complete
      await Promise.all(promises);
    }
  } else {
    // Sequential execution
    logger.debug(`Executing ${subTasks.length} subtasks sequentially`);
    
    for (const task of subTasks) {
      await executeOneSubTask(task, toolMap, messages, {
        ...options,
        executionDepth
      });
    }
  }
}

/**
 * Performs a fetch request with timeout support.
 * @param url The URL to fetch
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds
 * @param signal AbortSignal for cancellation
 * @returns Response object
 */
async function fetchWithTimeout(
  url: string,
  options: any,
  timeoutMs?: number,
  signal?: NodeAbortSignal
): Promise<Response> {
  // Setup timeout controller
  const timeoutController = new AbortController();
  const timeoutId = timeoutMs
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;

  try {
    // Combine signals if needed
    let combinedSignal: NodeAbortSignal;
    if (signal) {
      const controller = new AbortController();
      if (signal.aborted || timeoutController.signal.aborted) {
        controller.abort();
      } else {
        const abortHandler = () => controller.abort();
        signal.addEventListener('abort', abortHandler);
        timeoutController.signal.addEventListener('abort', abortHandler);
      }
      combinedSignal = controller.signal;
    } else {
      combinedSignal = timeoutController.signal;
    }

    // Execute the fetch with combined signal
    const response = await fetch(url, {
      ...options,
      signal: combinedSignal as any, // Type cast for node-fetch compatibility
    });

    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Performs a single chat completion with streaming, SSE parsing, retries, and timeouts.
 */
async function chatCompletion(
  messages: Message[],
  tools: any[],
  options: RunOptions
): Promise<{ content?: string; toolCalls?: { name: string; arguments: string }[] }> {
  const {
    modelName = 'gpt-4.1',
    maxRetries = 3,
    retryDelayMs = 1000,
    signal,
    timeoutMs,
    logger = defaultLogger,
  } = options;

  const payload = {
    model: modelName,
    messages: messages.map(msg => {
      // Clean up message objects to match OpenAI API expectations
      const cleanMsg: any = { role: msg.role };

      if (msg.content !== null && msg.content !== undefined) {
        cleanMsg.content = msg.content;
      } else {
        cleanMsg.content = "";
      }

      if (msg.tool_calls) cleanMsg.tool_calls = msg.tool_calls;
      if (msg.tool_call_id) cleanMsg.tool_call_id = msg.tool_call_id;

      return cleanMsg;
    }),
    stream: true,
    tools,
    tool_choice: 'auto',
  };

  logger.debug(`Sending request to OpenAI API with model: ${modelName}`);

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        },
        timeoutMs,
        signal
      );

      // Handle HTTP errors
      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`HTTP ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      if (!res.body) throw new Error('No response body');

      // Stream processing for node-fetch (which returns a node Readable stream)
      const result = await processStreamResponse(res.body as unknown as Readable, logger);
      return result;
    } catch (err: any) {
      // Abort by user or timeout
      if (signal?.aborted) throw new Error('Aborted');

      const status = err.status;
      // Retry transient errors
      if (
        attempt <= maxRetries &&
        (isRetryable(err) || [429, 502, 503].includes(status))
      ) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`API request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${err.message}`);
        await sleep(delay, signal);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Processes an SSE stream from OpenAI API.
 * @param stream Readable stream of SSE events
 * @param logger Logger instance
 * @returns Parsed content and tool calls
 */
async function processStreamResponse(
  stream: Readable,
  logger: Logger
): Promise<{ content?: string; toolCalls?: { name: string; arguments: string }[] }> {
  const decoder = new TextDecoder();
  let buffer = '';
  const rawDataLines: string[] = []; // Store raw data lines

  // Phase 1: Collect all data lines from the stream
  for await (const chunk of stream) {
    const decoded = decoder.decode(chunk as Buffer, { stream: true });
    buffer += decoded;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.replace(/^data: /, '').trim();
        if (data === '[DONE]') continue; // Ignore DONE marker for now
        rawDataLines.push(data); // Store the raw JSON string
      }
    }
  }
  
  // Process any remaining data in the buffer after the stream ends
  if (buffer.startsWith('data: ')) {
    const data = buffer.replace(/^data: /, '').trim();
    if (data !== '[DONE]') {
      rawDataLines.push(data);
    }
  }

  // Phase 2: Process collected data lines
  let content = '';
  const toolCallsMap: Record<string, { name: string; arguments: string }> = {};
  const indexToIdMap: Record<number, string> = {}; // Map index to tool call ID

  for (const data of rawDataLines) {
    try {
      const msg = JSON.parse(data);
      // Ensure the expected structure exists before accessing delta
      if (msg.choices && msg.choices.length > 0 && msg.choices[0].delta) {
        const delta = msg.choices[0].delta;

        // Accumulate content
        if (delta.content) {
          content += delta.content;
        }

        // Accumulate tool calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;

            if (toolCallDelta.id) {
              // First chunk for this tool call index: store ID and name
              const id = toolCallDelta.id;
              indexToIdMap[index] = id; // Store the index -> id mapping

              if (!toolCallsMap[id]) {
                toolCallsMap[id] = { name: '', arguments: '' };
              }
              if (toolCallDelta.function?.name) {
                toolCallsMap[id].name = toolCallDelta.function.name;
              }
              // Append any arguments from this first chunk
              if (toolCallDelta.function?.arguments) {
                toolCallsMap[id].arguments += toolCallDelta.function.arguments;
              }
            } else if (index !== undefined && toolCallDelta.function?.arguments) {
              // Subsequent chunk: use index to find id and append arguments
              const id = indexToIdMap[index];
              if (id && toolCallsMap[id]) {
                toolCallsMap[id].arguments += toolCallDelta.function.arguments;
              } else {
                // Should not happen in a well-formed stream, but good to log
                logger.warn(`Received tool call argument chunk for index ${index} but no corresponding ID was found.`);
              }
            }
          }
        }
      } else if (msg.choices && msg.choices.length > 0 && msg.choices[0].finish_reason) {
        // Expected final chunk, contains finish_reason, no delta processing needed here.
      } else {
        logger.warn(`Skipping unexpected SSE data structure: ${data}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // Add the problematic data line to the error message for context
      logger.warn(`Error parsing collected SSE data: ${errorMsg}. Data: "${data}"`);
    }
  }

  // Phase 3: Return results
  const toolCalls = Object.values(toolCallsMap).filter(tc => tc.name); // Ensure name is present
  if (toolCalls.length > 0) {
    // If tool calls were generated, prioritize returning them
    return { toolCalls };
  } else if (content) {
    // Otherwise, return the accumulated content
    return { content };
  } else {
    // Handle cases where the stream finished but produced neither content nor valid tool calls
    logger.warn("Stream finished without producing content or tool calls.");
    return {}; // Or potentially throw an error, depending on desired behavior
  }
}

/**
 * Returns a Promise that resolves after ms, or rejects early if signal aborts.
 */
function sleep(ms: number, signal?: NodeAbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    const abortHandler = () => {
      clearTimeout(id);
      reject(new Error('Aborted'));
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(id);
        reject(new Error('Aborted'));
      } else {
        signal.addEventListener('abort', abortHandler);

        // Clean up event listener if promise resolves
        setTimeout(() => {
          signal.removeEventListener('abort', abortHandler);
        }, ms);
      }
    }
  });
}

/**
 * Checks if an error is likely transient and worth retrying.
 */
function isRetryable(err: any): boolean {
  return (
    err.name === 'FetchError' ||
    err.name === 'TimeoutError' ||
    err.code === 'ECONNRESET'
  );
}

/**
 * Safely parses JSON with a fallback for empty or malformed input.
 * Returns undefined if the input is not valid JSON.
 */
function safeParseArgs(rawArgs: string, logger: Logger = defaultLogger): any {
  if (rawArgs == null) return undefined;        // null or undefined
  const trimmed = rawArgs.trim();
  if (!trimmed) return undefined;               // empty or whitespace only

  // Heuristic: Only try parse if it "looks like" JSON
  if (!/^(\{|\[)/.test(trimmed)) {
    logger.warn(`Arguments don't look like JSON: "${trimmed}"`);
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Log the raw JSON for debugging
    logger.warn(`Raw JSON that failed to parse: ${trimmed}`);
    
    // Attempt basic repair
    try {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.warn(`Error parsing JSON arguments: ${errorMsg}`);

      let repaired = trimmed;
      const openBraces = (trimmed.match(/{/g) || []).length;
      const closeBraces = (trimmed.match(/}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      const openBrackets = (trimmed.match(/\[/g) || []).length;
      const closeBrackets = (trimmed.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';

      const result = JSON.parse(repaired);
      logger.info(`Repaired JSON successfully: ${JSON.stringify(result)}`);
      return result;
    } catch (repairErr) {
      // Log and return undefined
      const repairErrorMsg = repairErr instanceof Error ? repairErr.message : String(repairErr);
      logger.warn(`Could not repair JSON: ${repairErrorMsg}`);
      return undefined;
    }
  }
}