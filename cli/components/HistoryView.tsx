import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import chalk from 'chalk';
import figures from 'figures';
import { HistoryItem } from '../types';
import wrapAnsi from 'wrap-ansi';
import stripAnsi from 'strip-ansi';

interface HistoryViewProps {
  history: HistoryItem[];
  height: number;
}

/**
 * Calculate how many lines a text string will take up when rendered
 * Accounts for line breaks, word wrapping, and terminal width
 */
function getLineCount(text: string, width: number): number {
  // Remove ANSI escape codes for accurate length calculation
  const cleanText = stripAnsi(text.toString());
  // Split by explicit line breaks
  const lines = cleanText.split('\n');
  let totalLines = 0;
  
  // For each line, calculate how many terminal lines it will occupy based on wrapping
  for (const line of lines) {
    totalLines += Math.max(1, Math.ceil(line.length / Math.max(1, width)));
  }
  
  return totalLines;
}

/**
 * Get estimated line height for a history item
 */
function getItemLineHeight(item: HistoryItem, width: number): number {
  // Base height depends on the item type
  let height = 1; // Minimum height
  
  switch (item.type) {
    case 'command':
      // Commands are typically a single line
      height = Math.max(1, getLineCount(item.content, width));
      break;
      
    case 'response':
      // Responses can be multi-line and have wrapping text
      height = Math.max(2, getLineCount(item.content, width)) + 1; // +1 for spacing
      break;
      
    case 'system':
      // System messages can include logos and multi-line text
      if (item.content.includes('_____    ____    ____')) {
        // Logo needs extra space
        height = 10; 
      } else if (item.content.includes('DOOM Commands:')) {
        // Help text is very large
        height = 25; // Command list is very tall
      } else if (item.content.includes('💡 Tips:')) {
        // Tips section also large
        height = 15;
      } else if (item.content.includes('📚 Available Tool Categories:')) {
        // Tool listing is very large
        height = 30;
      } else {
        // Regular system messages
        height = getLineCount(item.content, width) + 1;
      }
      break;
      
    case 'error':
      // Error messages are typically a single line
      height = Math.max(1, getLineCount(item.content, width)) + 1;
      break;
      
    case 'tool':
      // Tool messages include the tool call and possibly a result line
      const hasResult = item.content.includes(' → ');
      const hasError = item.content.includes(' - Error: ');
      // Add extra lines for tool messages to ensure proper spacing
      height = getLineCount(item.content, width) + (hasResult || hasError ? 2 : 1);
      break;
  }
  
  // Add a minimum buffer to all items for better spacing
  return Math.max(2, height);
}

/**
 * HistoryView component displays command history and responses
 */
function HistoryView({ history, height }: HistoryViewProps) {
  // Get terminal dimensions
  const { stdout } = useStdout();
  const width = stdout?.columns || process.stdout.columns || 80;
  
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

  // Calculate which history items to show based on their rendered line height
  const visibleHistory = useMemo(() => {
    // Add a safety buffer to ensure we don't overflow
    const safeHeight = Math.max(1, height - 2); // 2 lines of safety buffer
    
    let totalHeight = 0;
    const result = [];
    
    // Start from the most recent message and work backwards
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      // Add extra padding for all items to ensure better separation
      const itemHeight = getItemLineHeight(item, width - 10) + 1; // add 1 line of padding between items
      
      // Stop if adding this item would exceed available height
      // Use a stricter limit to prevent overflow
      if (totalHeight + itemHeight > safeHeight) {
        break;
      }
      
      // Add item to the start of our result array (to maintain order)
      result.unshift(item);
      totalHeight += itemHeight;
    }
    
    // If we have items, ensure at least one is shown (for very tight spaces)
    if (result.length === 0 && history.length > 0) {
      result.push(history[history.length - 1]);
    }
    
    return result;
  }, [history, height, width]);

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