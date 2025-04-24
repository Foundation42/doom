import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

interface DebugPanelProps {
  visible: boolean;
  maxHeight?: number;
}

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'warn' | 'error' | 'debug';
}

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 50;

// Global log store to share across renders
const logStore: LogEntry[] = [];

// Expose log functions to be used from anywhere
export const debugLogger = {
  info: (message: string) => {
    addLogEntry({ message, type: 'info' });
  },
  warn: (message: string) => {
    addLogEntry({ message, type: 'warn' });
  },
  error: (message: string) => {
    addLogEntry({ message, type: 'error' });
  },
  debug: (message: string) => {
    addLogEntry({ message, type: 'debug' });
  }
};

// Add a log entry to the global store
function addLogEntry(entry: Omit<LogEntry, 'timestamp'>) {
  const logEntry: LogEntry = {
    ...entry,
    timestamp: new Date()
  };
  
  // Add to the store
  logStore.push(logEntry);
  
  // Keep only the most recent entries
  if (logStore.length > MAX_LOG_ENTRIES) {
    logStore.shift();
  }
  
  // Also trigger any update callbacks
  updateCallbacks.forEach(callback => callback(logStore));
}

// Callbacks for components to be notified of updates
const updateCallbacks: ((logs: LogEntry[]) => void)[] = [];

/**
 * Debug panel component that shows log messages
 */
function DebugPanel({ visible, maxHeight = 10 }: DebugPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>(logStore);
  
  // Register for updates when logs change
  useEffect(() => {
    const callback = (updatedLogs: LogEntry[]) => {
      setLogs([...updatedLogs]);
    };
    
    updateCallbacks.push(callback);
    
    // Cleanup on unmount
    return () => {
      const index = updateCallbacks.indexOf(callback);
      if (index !== -1) {
        updateCallbacks.splice(index, 1);
      }
    };
  }, []);
  
  if (!visible) {
    return null;
  }
  
  // Always render the panel, even when empty
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={maxHeight}
    >
      <Box paddingX={1} paddingY={0}>
        <Text bold color="yellow">Debug Log</Text>
      </Box>
      <Box flexDirection="column" overflow="hidden" height={maxHeight - 2}>
        {logs.slice(-maxHeight + 2).map((log, i) => (
          <Box key={i} paddingX={1}>
            <Text
              color={
                log.type === 'error' ? 'red' : 
                log.type === 'warn' ? 'yellow' : 
                log.type === 'debug' ? 'blue' : 
                'green'
              }
            >
              [{log.timestamp.toISOString().substring(11, 19)}] {log.message}
            </Text>
          </Box>
        ))}
        {/* Fill empty space with blank lines if needed */}
        {Array.from({ length: Math.max(0, maxHeight - 2 - logs.length) }).map((_, i) => (
          <Box key={`empty-${i}`} paddingX={1}>
            <Text> </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default DebugPanel;