// Import directly from src files vs using the module export
import { runChatWithTools } from '../../src/chatrunner';
import { Message, Tool, ToolExecutionEvent } from '../../src/types';
import { Dispatch } from 'react';
import { HistoryItem, TerminalAction } from '../state/terminalReducer';
import { convertToolExecutionToState, generateDeterministicToolExecutionId } from '../utils/tools';
import { debugLogger } from '../components/DebugPanel';

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
  
  // Add user message to history first - this ensures the command is displayed
  dispatch({ 
    type: 'ADD_HISTORY_ITEM', 
    item: {
      type: 'command',
      content: input,
      timestamp: new Date()
    }
  });
  
  // Add user message to messages for LLM context
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
      
      // Log the tool execution event
      debugLogger.info(`Tool execution: ${toolName}(${Object.keys(args).join(',')})`);
      
      // Generate a deterministic ID for this tool execution
      const executionId = generateDeterministicToolExecutionId(toolName, args, parentToolName);
      
      // Create a tool execution entry for state with the deterministic ID
      const toolExecution = convertToolExecutionToState(
        toolName,
        args,
        result,
        isSubtask,
        parentToolName,
        error,
        executionId // Pass the deterministic ID
      );
      
      // Add a debug log to track tool executions
      console.log('🛠️ Tool execution event:', { toolName, isSubtask, status: error ? 'error' : result ? 'success' : 'running' });
      debugLogger.debug(`Tool status: ${error ? 'error' : result ? 'success' : 'running'}, ID: ${executionId}`);
      
      // Always collect and store tool executions, regardless of display setting
      if (error) {
        debugLogger.error(`Tool error: ${error}`);
        
        // Use UPDATE_TOOL_EXECUTION action regardless - our deterministic ID will match correctly
        dispatch({ type: 'UPDATE_TOOL_EXECUTION', execution: toolExecution });
        
        // Add tool error to history
        if (showTools) {
          dispatch({ 
            type: 'ADD_HISTORY_ITEM', 
            item: { 
              type: 'tool', 
              content: `${toolName}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}) - Error: ${error}`,
              timestamp: new Date()
            } 
          });
        }
      } else if (result) {
        debugLogger.info(`Tool result: ${result?.substring(0, 40)}${result?.length > 40 ? '...' : ''}`);
        
        // Use UPDATE_TOOL_EXECUTION action regardless - our deterministic ID will match correctly
        dispatch({ type: 'UPDATE_TOOL_EXECUTION', execution: {
          ...toolExecution,
          executionTime
        }});
        
        // Add completed tool with result to history
        if (showTools) {
          dispatch({ 
            type: 'ADD_HISTORY_ITEM', 
            item: { 
              type: 'tool', 
              content: `${toolName}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}) → ${result?.substring(0, 60)}${result?.length > 60 ? '...' : ''} (${executionTime}ms)`,
              timestamp: new Date()
            } 
          });
        }
      } else {
        // This is a tool start event
        debugLogger.debug(`Tool started: ${toolName} with ID ${executionId}`);
        
        dispatch({ type: 'ADD_TOOL_EXECUTION', execution: toolExecution });
        
        // Add tool start to history
        if (showTools) {
          dispatch({ 
            type: 'ADD_HISTORY_ITEM', 
            item: { 
              type: 'tool', 
              content: `Running ${toolName}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})...`,
              timestamp: new Date()
            } 
          });
        }
      }
    };
    
    // Add debug log for user input
    debugLogger.info(`Processing user input: ${input}`);
    debugLogger.debug(`Config - showTools: ${showTools}, parallel: ${parallel}`);
    
    // Run chat with tools
    const response = await runChatWithTools(currentMessages, tools, {
      signal: controller.signal,
      temperature: 0.7,
      logger: createReplLogger(),
      timeoutMs: 55000,
      maxRetries: 2,
      parallel,
      // Always attach the handler to collect tool executions, regardless of display setting
      onToolExecution: handleToolExecution,
      showToolCalls: true // Always set to true to emit tool execution events
    });
    
    // Add debug log
    console.log('📝 Received LLM response');
    
    // Add assistant response to history
    const responseItem: HistoryItem = {
      type: 'response',
      content: response,
      timestamp: new Date()
    };
    
    dispatch({ type: 'ADD_HISTORY_ITEM', item: responseItem });
    
    // Don't clear tool executions - keep them visible
    // dispatch({ type: 'CLEAR_TOOL_EXECUTIONS' });
    
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