import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface StatusBarProps {
  mode: 'command' | 'input' | 'thinking';
  parallel: boolean;
  showTools: boolean;
  debugMode: boolean;
}

/**
 * StatusBar component shows the current state and available shortcuts
 */
function StatusBar({ mode, parallel, showTools, debugMode }: StatusBarProps) {
  return (
    <Box justifyContent="space-between" borderStyle="single" borderColor="gray">
      <Box>
        <Box marginRight={2}>
          <Text>Mode: {renderMode(mode)}</Text>
        </Box>
        <Box marginRight={2}>
          <Text>Parallel: {parallel ? <Text color="green">{figures.tick}</Text> : <Text color="red">{figures.cross}</Text>}</Text>
        </Box>
        <Box marginRight={2}>
          <Text>Tools: {showTools ? <Text color="green">{figures.tick}</Text> : <Text color="red">{figures.cross}</Text>}</Text>
        </Box>
        <Box>
          <Text>Debug: {debugMode ? <Text color="green">{figures.tick}</Text> : <Text color="red">{figures.cross}</Text>}</Text>
        </Box>
      </Box>
      <Box>
        <Text dimColor>/help</Text>
      </Box>
    </Box>
  );
}

/**
 * Render the current mode with appropriate styling
 */
function renderMode(mode: 'command' | 'input' | 'thinking') {
  switch (mode) {
    case 'command':
      return <Text color="green">READY</Text>;
    case 'thinking':
      return <Text color="yellow">THINKING</Text>;
    case 'input':
      return <Text color="blue">INPUT</Text>;
  }
}

export default StatusBar;