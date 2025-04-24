import React, { useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import chalk from 'chalk';

interface InputBoxProps {
  inputValue: string;
  cursorPosition: number;
  completions: string[];
  selectedCompletionIndex: number;
  isCompletionVisible: boolean;
  width: number;
}

/**
 * InputBox component that handles rendering the input area with cursor and completions
 */
function InputBox({
  inputValue,
  cursorPosition,
  completions,
  selectedCompletionIndex,
  isCompletionVisible,
  width
}: InputBoxProps) {
  // Calculate parts of the input for cursor rendering
  const textBeforeCursor = inputValue.substring(0, cursorPosition);
  const cursorChar = inputValue.charAt(cursorPosition) || ' ';
  const textAfterCursor = inputValue.substring(cursorPosition + 1);

  // Get the current line for multi-line inputs
  const currentLineNumber = (textBeforeCursor.match(/\n/g) || []).length + 1;
  const totalLines = (inputValue.match(/\n/g) || []).length + 1;

  // Split input at cursor position for better display in multi-line inputs
  const lines = inputValue.split('\n');
  const currentLine = currentLineNumber <= lines.length ? lines[currentLineNumber - 1] : '';

  // Render the input prompt based on whether it's a multi-line input
  const prompt = totalLines > 1 
    ? chalk.cyan(`${figures.arrowRight} (${currentLineNumber}/${totalLines})`) 
    : chalk.cyan(figures.arrowRight);

  // Determine if we should show completions
  const shouldShowCompletions = isCompletionVisible && completions.length > 0;

  return (
    <Box flexDirection="column">
      {/* Input box */}
      <Box>
        <Box marginRight={1}>
          <Text>{prompt}</Text>
        </Box>
        <Box>
          <Text>{textBeforeCursor}</Text>
          <Text inverse>{cursorChar}</Text>
          <Text>{textAfterCursor}</Text>
        </Box>
      </Box>

      {/* Completions dropdown */}
      {shouldShowCompletions && (
        <Box flexDirection="column" borderStyle="round" borderColor="gray">
          {completions.map((completion, index) => (
            <Text key={completion} color={index === selectedCompletionIndex ? 'cyan' : undefined}>
              {index === selectedCompletionIndex ? figures.pointer + ' ' : '  '}
              {completion}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default InputBox;