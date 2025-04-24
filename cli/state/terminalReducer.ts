import { HistoryItem, ToolExecution } from '../types';
import { createTools, listToolsByCategory } from '../utils/tools';

/**
 * Terminal state
 */
export interface TerminalState {
  // Input state
  inputValue: string;
  cursorPosition: number;
  
  // History state
  history: HistoryItem[];
  historyIndex: number;
  
  // Command completion
  completions: string[];
  selectedCompletionIndex: number;
  isCompletionVisible: boolean;
  
  // Tool execution state
  toolExecutions: ToolExecution[];
  
  // Terminal mode
  mode: 'command' | 'input' | 'thinking';
  
  // Settings
  parallel: boolean;
  showTools: boolean;
}

/**
 * Actions for the terminal reducer
 */
export type TerminalAction =
  | { type: 'UPDATE_INPUT'; value: string; setCursor?: number }
  | { type: 'MOVE_CURSOR'; direction: number }
  | { type: 'CURSOR_LINE_START' }
  | { type: 'CURSOR_LINE_END' }
  | { type: 'BACKSPACE' }
  | { type: 'DELETE' }
  | { type: 'SUBMIT_COMMAND'; rawInput?: string }
  | { type: 'ADD_HISTORY_ITEM'; item: HistoryItem }
  | { type: 'NAVIGATE_HISTORY'; direction: number }
  | { type: 'SHOW_COMPLETIONS'; completions: string[] }
  | { type: 'HIDE_COMPLETIONS' }
  | { type: 'CANCEL_COMPLETION' }
  | { type: 'CYCLE_COMPLETION'; direction: number }
  | { type: 'ADD_TOOL_EXECUTION'; execution: ToolExecution }
  | { type: 'UPDATE_TOOL_EXECUTION'; execution: ToolExecution }
  | { type: 'CLEAR_TOOL_EXECUTIONS' }
  | { type: 'PRUNE_TOOL_EXECUTIONS'; maxCount: number }
  | { type: 'SET_MODE'; mode: 'command' | 'input' | 'thinking' }
  | { type: 'TOGGLE_PARALLEL' }
  | { type: 'TOGGLE_SHOW_TOOLS' };

/**
 * Initial state for the terminal
 */
export const initialState: TerminalState = {
  inputValue: '',
  cursorPosition: 0,
  history: [],
  historyIndex: -1,
  completions: [],
  selectedCompletionIndex: 0,
  isCompletionVisible: false,
  toolExecutions: [],
  mode: 'command',
  parallel: false,
  showTools: true,
};

/**
 * Helper to get current line position in a multi-line string
 */
function getCurrentLinePosition(text: string, cursorPosition: number): { lineStart: number; lineEnd: number } {
  const textBeforeCursor = text.substring(0, cursorPosition);
  const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
  const lineEnd = text.indexOf('\n', cursorPosition);
  return {
    lineStart,
    lineEnd: lineEnd === -1 ? text.length : lineEnd,
  };
}

/**
 * Reducer for terminal state
 */
export function reducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'UPDATE_INPUT':
      return {
        ...state,
        inputValue: action.value,
        // If setCursor is provided, use it directly, otherwise calculate cursor position
        cursorPosition: action.setCursor !== undefined 
          ? action.setCursor 
          : state.cursorPosition + (action.value.length - state.inputValue.length),
      };
      
    case 'MOVE_CURSOR':
      const newPosition = state.cursorPosition + action.direction;
      return {
        ...state,
        cursorPosition: Math.max(0, Math.min(newPosition, state.inputValue.length)),
      };
      
    case 'CURSOR_LINE_START': {
      const { lineStart } = getCurrentLinePosition(state.inputValue, state.cursorPosition);
      return {
        ...state,
        cursorPosition: lineStart,
      };
    }
    
    case 'CURSOR_LINE_END': {
      const { lineEnd } = getCurrentLinePosition(state.inputValue, state.cursorPosition);
      return {
        ...state,
        cursorPosition: lineEnd,
      };
    }
    
    case 'BACKSPACE': {
      if (state.cursorPosition === 0) {
        return state;
      }
      
      const backspaceValue = state.inputValue.substring(0, state.cursorPosition - 1) + state.inputValue.substring(state.cursorPosition);
      const backspacePosition = state.cursorPosition - 1;
      
      return {
        ...state,
        inputValue: backspaceValue,
        cursorPosition: backspacePosition,
      };
    }
      
    case 'DELETE':
      if (state.cursorPosition >= state.inputValue.length) return state;
      return {
        ...state,
        inputValue: state.inputValue.substring(0, state.cursorPosition) + state.inputValue.substring(state.cursorPosition + 1),
      };
      
    case 'SUBMIT_COMMAND':
      // Get input either from raw input (fallback mode) or state
      const trimmedInput = action.rawInput?.trim() || state.inputValue.trim();
      if (!trimmedInput) return state;
      
      // Handle slash commands
      if (trimmedInput.startsWith('/')) {
        // Will handle special commands here
        const command = trimmedInput.substring(1).toLowerCase();
        
        if (command === 'exit') {
          // Use the cleaner exit function if it exists
          if ((global as any).doomExit) {
            (global as any).doomExit();
          } else {
            // Fallback to process.exit
            process.exit(0);
          }
          return state; // This will be ignored after exit
        }
        
        if (command === 'clear') {
          return {
            ...state,
            history: [],
            inputValue: '',
            cursorPosition: 0,
          };
        }
        
        if (command === 'parallel on') {
          return {
            ...state,
            parallel: true,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: 'Parallel execution enabled' },
            ],
          };
        }
        
        if (command === 'parallel off') {
          return {
            ...state,
            parallel: false,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: 'Parallel execution disabled' },
            ],
          };
        }
        
        if (command === 'tools on') {
          return {
            ...state,
            showTools: true,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: 'Tool visualization enabled' },
            ],
          };
        }
        
        if (command === 'tools off') {
          return {
            ...state,
            showTools: false,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: 'Tool visualization disabled' },
            ],
          };
        }
        
        if (command === 'help' || command === '?') {
          return {
            ...state,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: 
`🔥 DOOM Commands:
  /exit          - Exit DOOM (if you dare)
  /help          - Show this help message
  /tools         - List all available weapons
  /clear         - Clear the conversation history
  /history       - Show conversation history for export
  /parallel on   - Enable parallel tool execution
  /parallel off  - Disable parallel tool execution
  /tools on      - Enable tool call visualization
  /tools off     - Disable tool call visualization

💡 Tips:
  - Ask questions naturally and DOOM will use weapons appropriately
  - For AI and LLM tools, provide sufficient text to analyze
  - Some tools like TTS and LLM tools require API keys in your environment
  - DOOM never ruins things (that's the whole point)
  
📋 Examples:
  - "What's the weather in Tokyo?"
  - "Calculate a 18% tip on a $45.50 bill"
  - "Summarize this article: [paste text here]"
  - "Translate this to Spanish: Hello, how are you?"
  - "Who are you and what weapons do you have?"` },
            ],
          };
        }
        
        if (command === 'tools') {
          // List available tools grouped by category
          const { allTools } = createTools();
          const toolsOutput = listToolsByCategory(allTools);
          
          return {
            ...state,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: toolsOutput },
            ],
          };
        }
        
        if (command === 'history') {
          // Format conversation history for display/export
          const conversationHistory = state.history
            .filter(item => item.type === 'command' || item.type === 'response')
            .map((item, index) => {
              const role = item.type === 'command' ? 'User' : 'DOOM';
              return `${role}: ${item.content}`;
            })
            .join('\n\n');
          
          const historyOutput = `📜 Conversation History:\n\n${conversationHistory || 'No conversation history yet.'}`;
          
          return {
            ...state,
            inputValue: '',
            cursorPosition: 0,
            history: [
              ...state.history,
              { type: 'command', content: trimmedInput },
              { type: 'system', content: historyOutput },
            ],
          };
        }

        // For now, just add command to history and clear input
        return {
          ...state,
          inputValue: '',
          cursorPosition: 0,
          history: [
            ...state.history, 
            { type: 'command', content: trimmedInput },
            { type: 'system', content: `Command not recognized: ${command}` },
          ],
        };
      }
      
      // Regular command (not a slash command)
      // For regular commands, we'll let the LLM handler add the command to history
      // This ensures commands and responses are paired together
      return {
        ...state,
        inputValue: '',
        cursorPosition: 0,
        mode: 'thinking',
      };
      
    case 'ADD_HISTORY_ITEM':
      return {
        ...state,
        history: [...state.history, action.item],
      };
      
    case 'NAVIGATE_HISTORY':
      const { direction } = action;
      const commandHistory = state.history
        .filter(item => item.type === 'command')
        .map(item => item.content);
      
      if (commandHistory.length === 0) return state;
      
      let newIndex = state.historyIndex + direction;
      
      // Going back to newest command
      if (newIndex < 0) {
        return {
          ...state,
          historyIndex: -1,
          inputValue: '',
          cursorPosition: 0,
          isCompletionVisible: false,
        };
      }
      
      // Cap at oldest command
      newIndex = Math.min(newIndex, commandHistory.length - 1);
      
      // Get the selected command
      const selectedCommand = newIndex >= 0 
        ? commandHistory[commandHistory.length - 1 - newIndex] 
        : '';
      
      return {
        ...state,
        historyIndex: newIndex,
        inputValue: selectedCommand,
        cursorPosition: selectedCommand.length,
        // Hide completions when navigating history
        isCompletionVisible: false,
      };
      
    case 'SHOW_COMPLETIONS':
      return {
        ...state,
        completions: action.completions,
        selectedCompletionIndex: 0,
        isCompletionVisible: true,
      };
      
    case 'HIDE_COMPLETIONS':
      return {
        ...state,
        isCompletionVisible: false,
      };
      
    case 'CANCEL_COMPLETION':
      return {
        ...state,
        isCompletionVisible: false,
      };
      
    case 'CYCLE_COMPLETION':
      if (!state.isCompletionVisible || state.completions.length === 0) return state;
      
      const nextIndex = (state.selectedCompletionIndex + action.direction) % state.completions.length;
      return {
        ...state,
        selectedCompletionIndex: nextIndex < 0 ? state.completions.length - 1 : nextIndex,
      };
      
    case 'ADD_TOOL_EXECUTION':
      return {
        ...state,
        toolExecutions: [...state.toolExecutions, action.execution],
      };
      
    case 'UPDATE_TOOL_EXECUTION':
      return {
        ...state,
        toolExecutions: state.toolExecutions.map(exec =>
          exec.id === action.execution.id ? action.execution : exec
        ),
      };
      
    case 'CLEAR_TOOL_EXECUTIONS':
      return {
        ...state,
        toolExecutions: [],
      };
      
    case 'PRUNE_TOOL_EXECUTIONS':
      // Keep only the most recent executions up to maxCount
      const { maxCount } = action;
      return {
        ...state,
        toolExecutions: state.toolExecutions.length > maxCount
          ? state.toolExecutions.slice(-maxCount) // Take the last 'maxCount' items
          : state.toolExecutions,
      };
      
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
      };
      
    case 'TOGGLE_PARALLEL':
      return {
        ...state,
        parallel: !state.parallel,
      };
      
    case 'TOGGLE_SHOW_TOOLS':
      return {
        ...state,
        showTools: !state.showTools,
      };
      
    default:
      return state;
  }
}