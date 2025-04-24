import React, { useReducer, useEffect } from 'react';
import { Box, useInput, useApp, useStdin } from 'ink';
import HistoryView from './HistoryView';
import InputBox from './InputBox';
import ToolExecutionVisualizer from './ToolExecutionVisualizer';
import StatusBar from './StatusBar';
import { initialState, reducer } from '../state/terminalReducer';

/**
 * Main Terminal component that contains the entire CLI interface
 */
function Terminal() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { stdout } = useApp();
  
  // Default dimensions if not available
  const width = stdout?.columns || process.stdout.columns || 80;
  const height = stdout?.rows || process.stdout.rows || 24;

  // Check if raw mode is supported
  const { isRawModeSupported, stdin } = useStdin();
  
  // Alternative fallback for input if raw mode is not supported
  useEffect(() => {
    if (!isRawModeSupported) {
      // Create a simple stdin listener instead
      const handleData = (data: Buffer) => {
        const input = data.toString();
        if (input.trim() === '/exit') {
          process.exit(0);
        }
        
        // For simplicity, just add the input as a command in our history
        if (input.trim()) {
          dispatch({ 
            type: 'ADD_HISTORY_ITEM', 
            item: { type: 'command', content: input.trim() } 
          });
        }
      };
      
      stdin.on('data', handleData);
      return () => {
        stdin.off('data', handleData);
      };
    }
  }, [isRawModeSupported]);
  
  // Handle keyboard input only if raw mode is supported
  useInput((input, key) => {
    if (!isRawModeSupported) {
      return;
    }
    
    // Handle special keys
    if (key.escape) {
      // Escape key functionality
      dispatch({ type: 'CANCEL_COMPLETION' });
      return;
    }

    if (key.tab) {
      // Tab completion
      dispatch({ type: 'CYCLE_COMPLETION', direction: key.shift ? -1 : 1 });
      return;
    }

    if (key.return) {
      // Submit command on Enter (unless Shift is held for multi-line)
      if (!key.shift) {
        dispatch({ type: 'SUBMIT_COMMAND' });
      } else {
        // Add a new line to input when Shift+Enter is pressed
        dispatch({ type: 'UPDATE_INPUT', value: state.inputValue + '\n' });
      }
      return;
    }

    // History navigation with up/down arrows
    if (key.upArrow) {
      dispatch({ type: 'NAVIGATE_HISTORY', direction: -1 });
      return;
    }

    if (key.downArrow) {
      dispatch({ type: 'NAVIGATE_HISTORY', direction: 1 });
      return;
    }

    // Cursor movement with left/right arrows
    if (key.leftArrow) {
      dispatch({ type: 'MOVE_CURSOR', direction: -1 });
      return;
    }

    if (key.rightArrow) {
      dispatch({ type: 'MOVE_CURSOR', direction: 1 });
      return;
    }

    // Home key moves cursor to start of line
    if (key.home) {
      dispatch({ type: 'CURSOR_LINE_START' });
      return;
    }

    // End key moves cursor to end of line
    if (key.end) {
      dispatch({ type: 'CURSOR_LINE_END' });
      return;
    }

    // Backspace and delete key functionality
    if (key.backspace) {
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    if (key.delete) {
      dispatch({ type: 'DELETE' });
      return;
    }

    // Ctrl+C exits the application
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }

    // For all other inputs, update the input value if it's a printable character
    if (input && !key.ctrl && !key.meta && !key.shift) {
      dispatch({ type: 'UPDATE_INPUT', value: state.inputValue.substring(0, state.cursorPosition) + input + state.inputValue.substring(state.cursorPosition) });
      dispatch({ type: 'MOVE_CURSOR', direction: input.length });
    }
  });

  return (
    <Box flexDirection="column" height={height}>
      <HistoryView 
        history={state.history} 
        height={height - 4} 
      />
      <ToolExecutionVisualizer 
        executions={state.toolExecutions} 
      />
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
      />
    </Box>
  );
}

export default Terminal;