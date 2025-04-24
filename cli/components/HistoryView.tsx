import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import figures from 'figures';
import { HistoryItem } from '../types';
import wrapAnsi from 'wrap-ansi';

interface HistoryViewProps {
  history: HistoryItem[];
  height: number;
}

/**
 * HistoryView component displays command history and responses
 */
function HistoryView({ history, height }: HistoryViewProps) {
  // If there's no history, show a waiting message (logo will be shown via the dispatch in Terminal)
  if (history.length === 0) {
    return (
      <Box flexDirection="column" height={height} overflowY="hidden">
        <Box marginY={1}>
          <Text color="gray">Initializing DOOM...</Text>
        </Box>
      </Box>
    );
  }

  // Only show the most recent items that fit in the view
  const maxItems = Math.min(history.length, height);
  const visibleHistory = history.slice(history.length - maxItems);

  return (
    <Box flexDirection="column" height={height} overflowY="hidden">
      {visibleHistory.map((item, index) => (
        <HistoryItemView key={index} item={item} />
      ))}
    </Box>
  );
}

/**
 * Render a single history item
 */
function HistoryItemView({ item }: { item: HistoryItem }) {
  // Format the content based on the item type
  switch (item.type) {
    case 'command':
      return (
        <Box>
          <Box marginRight={1}>
            <Text color="green">{figures.arrowRight}</Text>
          </Box>
          <Text>{item.content}</Text>
        </Box>
      );
      
    case 'response':
      return (
        <Box flexDirection="column" marginY={1}>
          <Box>
            <Box marginRight={1}>
              <Text color="red" bold>DOOM:</Text>
            </Box>
            <Text>{wrapAnsi(item.content, process.stdout.columns - 10)}</Text>
          </Box>
        </Box>
      );
      
    case 'system':
      // Special handling for logo and banner - no modifications needed as they are pre-formatted
      if (item.content.includes('_____    ____    ____') || item.content.includes('DOOM (v1.0)')) {
        return (
          <Box>
            <Text color="red">{item.content}</Text>
          </Box>
        );
      }
      
      // Regular system messages
      return (
        <Box>
          <Text color="yellow">{item.content}</Text>
        </Box>
      );
      
    case 'error':
      return (
        <Box>
          <Text color="red">{figures.cross} {item.content}</Text>
        </Box>
      );
      
    case 'tool':
      return (
        <Box>
          <Box marginRight={1}>
            <Text color="cyan">{figures.info}</Text>
          </Box>
          <Text>{item.content}</Text>
        </Box>
      );
      
    default:
      return <Text>{item.content}</Text>;
  }
}

export default HistoryView;