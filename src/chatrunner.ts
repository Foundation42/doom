import fetch, { Response } from 'node-fetch';
import { AbortController } from 'abort-controller';
import { Message, Tool, RunOptions, SubTask, ToolResult } from './types';
import { TextDecoder } from 'util';
import { Readable } from 'stream';

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
  const messages: Message[] = [...history];
  const apiTools = tools.map(({ name, description, parameters }) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters,
    }
  }));

  // Pre-abort check
  if (signal?.aborted) throw new Error('Aborted');
  const onAbort = () => {};
  signal?.addEventListener('abort', onAbort);

  try {
    while (true) {
      const result = await chatCompletion(messages, apiTools, options);

      // If model requested tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`Received ${result.toolCalls.length} tool calls from LLM`);
        
        // Process each tool call
        for (const { name, arguments: rawArgs } of result.toolCalls) {
          console.log(`Processing tool call: ${name} with args: ${rawArgs}`);
          
          const tool = tools.find(t => t.name === name);
          if (!tool) throw new Error(`Tool ${name} not found`);

          // Parse args and execute the tool
          const args = safeParseArgs(rawArgs) || {};
          
          const res = await tool.func(args);
          
          // Extract output and any sub-tasks
          let output: string;
          let subTasks: SubTask[] | undefined;
          
          if (typeof res === 'string') {
            output = res;
          } else {
            output = res.output;
            subTasks = res.subTasks;
          }

          // Append tool call to conversation
          const callId = `call_${Math.random().toString(36).substr(2, 9)}`;
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
            content: output, 
            tool_call_id: callId 
          });
          
          // Process any sub-tasks recursively
          if (subTasks && subTasks.length > 0) {
            console.log(`Processing ${subTasks.length} subtasks for ${name}`);
            await executeSubTasks(subTasks, tools, messages, options);
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
 * Executes an array of sub-tasks sequentially, feeding results back into the conversation.
 */
async function executeSubTasks(
  subTasks: SubTask[],
  tools: Tool[],
  messages: Message[],
  options: RunOptions
): Promise<void> {
  for (const task of subTasks) {
    console.log(`Executing subtask: ${task.toolName} with args:`, task.args);
    
    // Find the tool by name
    const tool = tools.find(t => t.name === task.toolName);
    if (!tool) {
      console.error(`Available tools: ${tools.map(t => t.name).join(', ')}`);
      throw new Error(`SubTask tool '${task.toolName}' not found`);
    }
    
    // Invoke the tool
    const result = await tool.func(task.args);
    
    // Extract output and any nested sub-tasks
    let output: string;
    let nestedSubTasks: SubTask[] | undefined;
    
    if (typeof result === 'string') {
      output = result;
    } else {
      output = result.output;
      nestedSubTasks = result.subTasks;
    }
    
    // Generate a unique call ID for this subtask (max 40 chars)
    const callId = `task_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Adding subtask result to conversation: ${callId}`);
    
    // Append invocation and output to conversation
    messages.push({ 
      role: 'assistant', 
      content: null, 
      tool_calls: [{ 
        id: callId, 
        type: 'function',
        function: { 
          name: task.toolName, 
          arguments: task.args ? JSON.stringify(task.args) : "{}" 
        } 
      }] 
    });
    
    messages.push({ 
      role: 'tool', 
      content: output, 
      tool_call_id: callId 
    });
    
    // Recursively handle nested subTasks
    if (nestedSubTasks && nestedSubTasks.length > 0) {
      console.log(`Processing ${nestedSubTasks.length} nested subtasks for ${task.toolName}`);
      await executeSubTasks(nestedSubTasks, tools, messages, options);
    }
  }
}

// Compatible AbortSignal type
type NodeAbortSignal = Pick<AbortSignal, 'aborted' | 'addEventListener' | 'removeEventListener'>;

/**
 * Performs a single chat completion with streaming, SSE parsing, retries, and timeouts.
 */
async function chatCompletion(
  messages: Message[],
  tools: any[],
  options: RunOptions
): Promise<{ content?: string; toolCalls?: { name: string; arguments: string }[] }> {
  const {
    modelName = 'gpt-4o-mini',
    temperature = 0,
    maxRetries = 3,
    retryDelayMs = 1000,
    signal,
    timeoutMs,
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
    temperature,
  };

  let attempt = 0;
  while (true) {
    attempt++;
    // Setup abort for timeout
    const timeoutController = new AbortController();
    const timeoutId = timeoutMs
      ? setTimeout(() => timeoutController.abort(), timeoutMs)
      : null;
    
    // Type-safe signal combining
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

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: combinedSignal as any, // Type cast for node-fetch compatibility
      });

      // Handle HTTP errors
      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`HTTP ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      if (!res.body) throw new Error('No response body');

      // Stream processing for node-fetch (which returns a node Readable stream)
      const stream = res.body as unknown as Readable;
      const decoder = new TextDecoder();
      let content = '';
      const toolCallsMap: Record<string, { name: string; arguments: string }> = {};
      let buffer = '';

      // Process the data events manually (node-fetch specific approach)
      for await (const chunk of stream) {
        // Decode the chunk and add it to our buffer
        const decoded = decoder.decode(chunk as Buffer, { stream: true });
        buffer += decoded;
        
        // Process any complete lines in the buffer
        const lines = buffer.split('\n');
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.replace(/^data: /, '').trim();
          if (data === '[DONE]') continue; // End of stream marker
          
          try {
            const msg = JSON.parse(data);
            const delta = msg.choices[0].delta;
            
            // Handle tool calls in the new API format
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const toolCall of delta.tool_calls) {
                const id = toolCall.id;
                if (!toolCallsMap[id]) {
                  toolCallsMap[id] = { name: '', arguments: '' };
                }
                
                if (toolCall.function) {
                  if (toolCall.function.name) toolCallsMap[id].name += toolCall.function.name;
                  if (toolCall.function.arguments) toolCallsMap[id].arguments += toolCall.function.arguments;
                }
              }
            }
            
            if (delta.content) content += delta.content;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.warn(`Error parsing SSE data: ${errorMsg}`);
          }
        }
      }
      
      // Process any remaining data in the buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.replace(/^data: /, '').trim();
        if (data && data !== '[DONE]') {
          try {
            const msg = JSON.parse(data);
            const delta = msg.choices[0].delta;
            
            // Handle tool calls in the new API format
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const toolCall of delta.tool_calls) {
                const id = toolCall.id;
                if (!toolCallsMap[id]) {
                  toolCallsMap[id] = { name: '', arguments: '' };
                }
                
                if (toolCall.function) {
                  if (toolCall.function.name) toolCallsMap[id].name += toolCall.function.name;
                  if (toolCall.function.arguments) toolCallsMap[id].arguments += toolCall.function.arguments;
                }
              }
            }
            
            if (delta.content) content += delta.content;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.warn(`Error parsing final SSE data: ${errorMsg}`);
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);

      const toolCalls = Object.values(toolCallsMap).filter(tc => tc.name);
      if (toolCalls.length > 0) {
        return { toolCalls };
      }
      return { content };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      // Abort by user or timeout
      if (signal?.aborted) throw new Error('Aborted');

      const status = err.status;
      // Retry transient errors
      if (
        attempt <= maxRetries &&
        (isRetryable(err) || [429, 502, 503].includes(status))
      ) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay, signal);
        continue;
      }
      throw err;
    }
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
function safeParseArgs(rawArgs: string): any {
  if (rawArgs == null) return undefined;        // null or undefined
  const trimmed = rawArgs.trim();
  if (!trimmed) return undefined;               // empty or whitespace only

  // Heuristic: Only try parse if it "looks like" JSON
  if (!/^(\{|\[)/.test(trimmed)) {
    console.warn(`Arguments don't look like JSON: "${trimmed}"`);
    return undefined;
  }
  
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Attempt basic repair
    try {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(`Error parsing JSON arguments: ${errorMsg}`);
      
      let repaired = trimmed;
      const openBraces = (trimmed.match(/{/g) || []).length;
      const closeBraces = (trimmed.match(/}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      
      const openBrackets = (trimmed.match(/\[/g) || []).length;
      const closeBrackets = (trimmed.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      
      const result = JSON.parse(repaired);
      console.log(`Repaired JSON successfully: ${JSON.stringify(result)}`);
      return result;
    } catch (repairErr) {
      // Log and return undefined
      const repairErrorMsg = repairErr instanceof Error ? repairErr.message : String(repairErr);
      console.warn(`Could not repair JSON: ${repairErrorMsg}`);
      return undefined;
    }
  }
}