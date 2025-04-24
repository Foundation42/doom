import { runChatWithTools } from '../../src';
import { Message, Tool, ToolExecutionEvent } from '../../src/types';
import { Dispatch } from 'react';
import { HistoryItem, TerminalAction } from '../state/terminalReducer';
import { convertToolExecutionToState } from '../utils/tools';

/**
 * Create a logger for the REPL
 */
const createReplLogger = () => ({
  debug: (message: string, ...args: any[]) => {
    // Skip most debug messages to reduce noise
  },
  info: (message: string, ...args: any[]) => {
    // We handle this with our tool execution handler
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  }
});

/**
 * Process user input by dispatching to the LLM
 */
export async function processUserInput(
  input: string,
  messages: Message[],
  tools: Tool[],
  parallel: boolean,
  showTools: boolean,
  dispatch: Dispatch<TerminalAction>
): Promise<void> {
  // Set mode to thinking
  dispatch({ type: 'SET_MODE', mode: 'thinking' });
  
  // Add user message to history
  const userMessage: Message = {
    role: 'user',
    content: input
  };
  
  const currentMessages = [...messages, userMessage];
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
  
  try {
    // Create a tool execution handler
    const handleToolExecution = (event: ToolExecutionEvent) => {
      const { toolName, args, result, executionTime, error, isSubtask, parentToolName } = event;
      
      // Create a tool execution entry for state
      const toolExecution = convertToolExecutionToState(
        toolName,
        args,
        result,
        isSubtask,
        parentToolName,
        error
      );
      
      if (error) {
        dispatch({ type: 'UPDATE_TOOL_EXECUTION', execution: toolExecution });
      } else if (result) {
        dispatch({ type: 'UPDATE_TOOL_EXECUTION', execution: {
          ...toolExecution,
          executionTime
        }});
      } else {
        dispatch({ type: 'ADD_TOOL_EXECUTION', execution: toolExecution });
      }
    };
    
    // Run chat with tools
    const response = await runChatWithTools(currentMessages, tools, {
      signal: controller.signal,
      temperature: 0.7,
      logger: createReplLogger(),
      timeoutMs: 55000,
      maxRetries: 2,
      parallel,
      onToolExecution: showTools ? handleToolExecution : undefined,
      showToolCalls: showTools // This needs to be true to emit tool execution events
    });
    
    // Add assistant response to history
    const responseItem: HistoryItem = {
      type: 'response',
      content: response,
      timestamp: new Date()
    };
    
    dispatch({ type: 'ADD_HISTORY_ITEM', item: responseItem });
    
    // Clear tool executions
    dispatch({ type: 'CLEAR_TOOL_EXECUTIONS' });
    
    // Set mode back to command
    dispatch({ type: 'SET_MODE', mode: 'command' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Add error message to history
    const errorItem: HistoryItem = {
      type: 'error',
      content: `Error: ${errorMessage}`,
      timestamp: new Date()
    };
    
    dispatch({ type: 'ADD_HISTORY_ITEM', item: errorItem });
    
    // Set mode back to command
    dispatch({ type: 'SET_MODE', mode: 'command' });
  } finally {
    clearTimeout(timeoutId);
  }
}