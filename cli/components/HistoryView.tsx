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
      // Determine tool execution state from content
      const isRunning = item.content.includes('Running ');
      const hasError = item.content.includes(' - Error: ');
      const hasResult = item.content.includes(' → ');
      
      // Format tool name and args for better display
      let formattedContent = item.content;
      
      if (isRunning) {
        // Format running tools: "Running toolName(args)..." becomes "toolName(args)"
        formattedContent = formattedContent.replace('Running ', '');
        formattedContent = formattedContent.replace('...', '');
      } else if (hasResult) {
        // Format tool results - Make arrow more prominent and add spacing
        const parts = formattedContent.split(' → ');
        if (parts.length === 2) {
          const toolPart = parts[0].trim();
          const resultPart = parts[1].trim();
          formattedContent = toolPart;
        }
      }
      
      return (
        <Box marginY={1}>
          <Box marginRight={1}>
            {isRunning ? (
              <Text color="blue">⚙️ </Text>
            ) : hasError ? (
              <Text color="red">✖ </Text>
            ) : (
              <Text color="green">✓ </Text>
            )}
          </Box>
          <Box flexDirection="column">
            <Text>{formattedContent}</Text>
            {hasResult && (
              <Box paddingLeft={2} marginTop={0}>
                <Text dimColor>↪ {item.content.split(' → ')[1].trim()}</Text>
              </Box>
            )}
            {hasError && (
              <Box paddingLeft={2} marginTop={0}>
                <Text color="red">{item.content.split(' - Error: ')[1].trim()}</Text>
              </Box>
            )}
          </Box>
        </Box>
      );
      
    default:
      return <Text>{item.content}</Text>;
  }
}

export default HistoryView;