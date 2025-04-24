/**
 * History item in the terminal
 */
export interface HistoryItem {
  type: 'command' | 'response' | 'system' | 'error' | 'tool';
  content: string;
  timestamp?: Date;
}

/**
 * Tool execution information
 */
export interface ToolExecution {
  id: string;
  toolName: string;
  args: any;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
  executionTime?: number;
  isSubtask?: boolean;
  parentToolId?: string;
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS = [
  '/help',
  '/exit',
  '/clear',
  '/tools',
  '/tools on',
  '/tools off',
  '/parallel on',
  '/parallel off',
  '/debug on',
  '/debug off',
];