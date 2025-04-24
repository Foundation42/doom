import React, { useReducer, useEffect, useState } from 'react';
import { Box, useInput, useApp, useStdin, Text } from 'ink';
import HistoryView from './HistoryView.js';
import InputBox from './InputBox.js';
import ToolExecutionVisualizer from './ToolExecutionVisualizer.js';
import StatusBar from './StatusBar.js';
import DebugPanel, { debugLogger } from './DebugPanel.js';
import { initialState, reducer } from '../state/terminalReducer.js';
import { createTools, getSystemMessage } from '../utils/tools.js';
import { processUserInput } from '../services/chatService.js';
import { Message } from '../../src/types.js';
import { DOOM_LOGO, DOOM_BANNER } from '../utils/constants.js';
import { TerminalSettings } from '../App.js';

/**
 * Main Terminal component that contains the entire CLI interface
 */
function Terminal({ initialSettings }: { initialSettings?: TerminalSettings }) {
  // Initialize with CLI arguments if provided
  const actualInitialState = {
    ...initialState,
    parallel: initialSettings?.parallel ?? initialState.parallel,
    showTools: initialSettings?.showTools ?? initialState.showTools
  };
  
  const [state, dispatch] = useReducer(reducer, actualInitialState);
  const { stdout } = useApp();
  
  // Default dimensions if not available
  const width = stdout?.columns || process.stdout.columns || 80;
  const height = stdout?.rows || process.stdout.rows || 24;

  // Check if raw mode is supported
  const { isRawModeSupported, stdin } = useStdin();
  
  // Debug raw mode support - disabled
  // console.error('Terminal component - isRawModeSupported:', isRawModeSupported);
  
  // Initialize LLM chat history and tools
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState<ReturnType<typeof createTools> | null>(null);
  
  
  // Initialize system message and tools
  useEffect(() => {
    // Add a debug log for initialization to ensure debug panel has content
    debugLogger.info('Terminal initialized');
    debugLogger.debug('Setting up system message and tools');
    
    // Initialize history with system message
    setMessages([
      {
        role: 'system',
        content: getSystemMessage()
      }
    ]);
    
    // Initialize tools
    const toolsData = createTools();
    setTools(toolsData);
    
    // Display startup banner
    dispatch({ type: 'ADD_HISTORY_ITEM', item: { type: 'system', content: DOOM_LOGO, timestamp: new Date() } });
    dispatch({ type: 'ADD_HISTORY_ITEM', item: { type: 'system', content: DOOM_BANNER, timestamp: new Date() } });
    
    // Display tool count
    const welcomeMessage = `🔥 Armed with ${toolsData.allTools.length} tools (${toolsData.standardTools.length} standard + ${toolsData.customTools.length} custom)`;
    dispatch({ type: 'ADD_HISTORY_ITEM', item: { type: 'system', content: welcomeMessage, timestamp: new Date() } });
    dispatch({ type: 'ADD_HISTORY_ITEM', item: { type: 'system', content: 'Type "/tools" to see available weapons, "/help" for commands, or "/exit" to quit.', timestamp: new Date() } });
    
    // Set up periodic cleanup of tool executions (every 5 minutes)
    const cleanupInterval = setInterval(() => {
      // Only keep recent tool executions (last 50)
      if (state.toolExecutions.length > 50) {
        dispatch({ type: 'PRUNE_TOOL_EXECUTIONS', maxCount: 50 });
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);
  
  // Alternative fallback for input if raw mode is not supported
  useEffect(() => {
    if (!isRawModeSupported) {
      let buffer = '';
      let multilineMode = false;
      
      // Create a simple stdin listener instead
      const handleData = (data: Buffer) => {
        const input = data.toString();
        
        // Check for special key inputs
        if (input === '\u0003') { // Ctrl+C
          if ((global as any).doomExit) {
            (global as any).doomExit();
          } else {
            process.exit(0);
          }
          return;
        }
        
        // Check for Enter key to submit (but not in multiline mode)
        if (input === '\n' || input === '\r' || input === '\r\n') {
          if (multilineMode) {
            // In multiline mode, add a newline to the buffer
            buffer += '\n';
            process.stdout.write('\n> '); // Show continuation prompt
            return;
          }
          
          // Process the complete input
          const finalInput = buffer.trim();
          buffer = ''; // Reset buffer
          
          if (!finalInput) return;
          
          // Handle exit command directly
          if (finalInput === '/exit') {
            if ((global as any).doomExit) {
              (global as any).doomExit();
            } else {
              process.exit(0);
            }
            return;
          }
          
          // Process slash commands through the reducer
          if (finalInput.startsWith('/')) {
            dispatch({ type: 'SUBMIT_COMMAND', rawInput: finalInput });
            return;
          }
          
          // For non-slash commands, we'll use dispatch({ type: 'SUBMIT_COMMAND' }) first to clear input
          // Then we let processUserInput handle adding to history
          dispatch({ type: 'SUBMIT_COMMAND', rawInput: finalInput });
          
          // Defensive: forcibly reset input after submit
          dispatch({ type: 'UPDATE_INPUT', value: '' });
          
          // Process regular input with the LLM if tools are loaded
          if (tools) {
            // Set mode to thinking
            dispatch({ type: 'SET_MODE', mode: 'thinking' });
            
            // Process with LLM
            processUserInput(
              finalInput,
              messages,
              tools.allTools,
              state.parallel,
              state.showTools,
              dispatch
            ).then(result => {
              // Update messages state
              setMessages(prevMessages => [
                ...prevMessages,
                { role: 'user', content: finalInput }
              ]);
            }).catch(error => {
              console.error('Error processing input:', error);
              // Add error message to history
              dispatch({ 
                type: 'ADD_HISTORY_ITEM', 
                item: {
                  type: 'error',
                  content: `Error processing input: ${error instanceof Error ? error.message : String(error)}`,
                  timestamp: new Date()
                }
              });
            });
          }
          return;
        }
        
        // Toggle multiline mode with Shift+Enter (usually comes as a specific key code)
        if (input === '\u001b[13;2u' || input === '\u001b[13;2~') {
          multilineMode = !multilineMode;
          process.stdout.write(multilineMode ? '\n[Multiline mode - press Enter twice to submit]\n> ' : '\n');
          return;
        }
        
        // For backspace/delete
        if (input === '\b' || input === '\x7f') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            process.stdout.write('\b \b'); // Erase last character
          }
          return;
        }
        
        // For all other inputs, add to buffer and echo
        buffer += input;
        process.stdout.write(input); // Echo the input
      };
      
      stdin.on('data', handleData);
      return () => {
        stdin.off('data', handleData);
      };
    }
  }, [isRawModeSupported, tools, messages, state.parallel, state.showTools]);
  
  // Handle keyboard input only if raw mode is supported
  useInput((input, key) => {
    // Only log if in debug mode
    if (false) {
      console.error(`[useInput] key event - raw input: "${input}"` + 
        ` (${Array.from(input).map(c => c.charCodeAt(0)).join(',')})` +
        `, key object: ${JSON.stringify(key)}`);
    }
    
    if (!isRawModeSupported) {
      return;
    }
    
    // Handle special keys first - this order matters!
    
    // Escape key functionality
    if (key.escape) {
      dispatch({ type: 'CANCEL_COMPLETION' });
      return;
    }

    // Backspace key - try all possible ways a terminal might report backspace
    if (key.backspace || key.name === 'backspace' || input === '\b' || input === '\x7f' || input === '\u007f') {
      dispatch({ type: 'BACKSPACE' });
      return;
    }
    
    // Delete key - in some terminals/environments backspace can be reported as delete
    if (key.delete) {
      // Use the backspace action instead of delete since that's what the user expects
      dispatch({ type: 'BACKSPACE' });
      return;
    }
    
    // Tab for completions
    if (key.tab) {
      // If completions are already showing, cycle through them
      if (state.isCompletionVisible && state.completions.length > 0) {
        dispatch({ type: 'CYCLE_COMPLETION', direction: key.shift ? -1 : 1 });
        return;
      }
      
      // Otherwise, generate completions based on current input
      const currentInput = state.inputValue;
      
      // Command completions (if input starts with /)
      if (currentInput.startsWith('/')) {
        const slashCommands = [
          '/help', '/exit', '/clear', '/tools', '/history',
          '/tools on', '/tools off', 
          '/parallel on', '/parallel off'
        ];
        
        // Find commands that match the current input
        const matchingCommands = slashCommands.filter(cmd => 
          cmd.startsWith(currentInput) && cmd !== currentInput
        );
        
        if (matchingCommands.length > 0) {
          dispatch({ type: 'SHOW_COMPLETIONS', completions: matchingCommands });
          return;
        }
      }
      
      // Tool name completions if tools are loaded
      if (tools && currentInput.length > 0 && !currentInput.includes(' ')) {
        const toolNames = tools.allTools.map(tool => tool.name);
        const matchingTools = toolNames.filter(name => 
          name.toLowerCase().startsWith(currentInput.toLowerCase()) && 
          name.toLowerCase() !== currentInput.toLowerCase()
        );
        
        if (matchingTools.length > 0) {
          dispatch({ type: 'SHOW_COMPLETIONS', completions: matchingTools });
          return;
        }
      }
      
      return;
    }

    // Enter key
    if (key.return) {    
      // If a completion is selected, use it
      if (state.isCompletionVisible && state.completions.length > 0) {
        const selectedCompletion = state.completions[state.selectedCompletionIndex];
        dispatch({ 
          type: 'UPDATE_INPUT', 
          value: selectedCompletion,
          setCursor: selectedCompletion.length
        });
        dispatch({ type: 'HIDE_COMPLETIONS' });
        return;
      }
            
      // Submit command on Enter (always handle as normal Enter for now)
      const trimmedInput = state.inputValue.trim();
      
      // For regular commands (not slash commands), handle differently
      if (trimmedInput && !trimmedInput.startsWith('/') && tools) {
        // First, clear the input (SUBMIT_COMMAND clears input)
        dispatch({ type: 'SUBMIT_COMMAND' });
        
        // Defensive: forcibly reset input after submit
        dispatch({ type: 'UPDATE_INPUT', value: '' });
        
        // Then process with the LLM (this function will add the command to history too)
        // Set up a global function to update messages with assistant responses
        (global as any).__updateTerminalMessages = (assistantMessage: Message) => {
          setMessages(prevMessages => [...prevMessages, assistantMessage]);
        };
        
        processUserInput(
          trimmedInput,
          messages,
          tools.allTools,
          state.parallel,
          state.showTools,
          dispatch
        ).then(result => {
          // After processing, update the messages state with the new message
          setMessages(prevMessages => [
            ...prevMessages,
            { role: 'user', content: trimmedInput }
          ]);
        }).catch(error => {
          console.error('Error processing input:', error);
          // Add error message to history
          dispatch({ 
            type: 'ADD_HISTORY_ITEM', 
            item: {
              type: 'error',
              content: `Error processing input: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date()
            }
          });
        });
      } else if (trimmedInput) {
        // For slash commands or empty input, just use the reducer
        dispatch({ type: 'SUBMIT_COMMAND' });
        
        // Defensive: forcibly reset input after submit
        dispatch({ type: 'UPDATE_INPUT', value: '' });
      }
      
      return;
    }

    // Arrow keys navigation
    if (key.upArrow) {
      dispatch({ type: 'NAVIGATE_HISTORY', direction: -1 });
      return;
    }

    if (key.downArrow) {
      dispatch({ type: 'NAVIGATE_HISTORY', direction: 1 });
      return;
    }

    if (key.leftArrow) {
      dispatch({ type: 'MOVE_CURSOR', direction: -1 });
      return;
    }

    if (key.rightArrow) {
      dispatch({ type: 'MOVE_CURSOR', direction: 1 });
      return;
    }

    // Home/End keys
    if (key.home) {
      dispatch({ type: 'CURSOR_LINE_START' });
      return;
    }

    if (key.end) {
      dispatch({ type: 'CURSOR_LINE_END' });
      return;
    }

    // Ctrl+C exits the application
    if (key.ctrl && input === 'c') {
      // Use the cleaner exit function if it exists
      if ((global as any).doomExit) {
        (global as any).doomExit();
      } else {
        // Fallback to process.exit
        process.exit(0);
      }
      return;
    }
    
    // Handle all printable characters (including space, slash, etc.)
    // Allow all input unless ctrl or meta is pressed
    if (input && !key.ctrl && !key.meta) {
      dispatch({ 
        type: 'UPDATE_INPUT', 
        value: state.inputValue.substring(0, state.cursorPosition) + input + state.inputValue.substring(state.cursorPosition) 
      });
      dispatch({ type: 'MOVE_CURSOR', direction: input.length });
      return;
    }
  });

  // Define a fixed size for the debug panel
  const DEBUG_PANEL_HEIGHT = 20;
  
  return (
    <Box flexDirection="column" height={height}>
      {state.debugMode && (
        <DebugPanel visible={true} maxHeight={DEBUG_PANEL_HEIGHT} />
      )}
      <HistoryView 
        history={state.history} 
        height={height - (state.debugMode ? DEBUG_PANEL_HEIGHT + 4 : 4)} 
      />
      {/* Tool visualization is now shown inline in the history instead of as a separate component */}
      <InputBox
        inputValue={state.inputValue}
        cursorPosition={state.cursorPosition}
        completions={state.completions}
        selectedCompletionIndex={state.selectedCompletionIndex}
        isCompletionVisible={state.isCompletionVisible}
        width={width}
      />
      <StatusBar 
        mode={state.mode}
        parallel={state.parallel}
        showTools={state.showTools}
        debugMode={state.debugMode}
      />
    </Box>
  );
}

export default Terminal;