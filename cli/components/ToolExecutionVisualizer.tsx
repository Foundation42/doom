import React from 'react';
import { Box, Text, Spinner } from 'ink';
import figures from 'figures';
import { ToolExecution } from '../types';

interface ToolExecutionVisualizerProps {
  executions: ToolExecution[];
}

/**
 * Visualizes the current tool executions and their status
 */
function ToolExecutionVisualizer({ executions }: ToolExecutionVisualizerProps) {
  // Only show running executions or the most recent completed ones (max 3)
  const visibleExecutions = executions
    .filter(exec => exec.status === 'running' || !!exec.endTime)
    .slice(-3);

  if (visibleExecutions.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      {visibleExecutions.map(execution => (
        <ToolExecutionItem key={execution.id} execution={execution} />
      ))}
    </Box>
  );
}

/**
 * Individual tool execution item
 */
function ToolExecutionItem({ execution }: { execution: ToolExecution }) {
  const isRunning = execution.status === 'running';
  const isError = execution.status === 'error';
  const isSuccess = execution.status === 'success';

  // Format args for display
  const argsStr = Object.entries(execution.args || {})
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');

  // Format the result (truncate if too long)
  const displayResult = execution.result && execution.result.length > 60
    ? execution.result.substring(0, 57) + '...'
    : execution.result;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        {isRunning && <Spinner type="dots" />}
        {isSuccess && <Text color="green">{figures.tick}</Text>}
        {isError && <Text color="red">{figures.cross}</Text>}
        
        <Box marginLeft={1}>
          <Text color={execution.isSubtask ? 'magenta' : 'cyan'} bold>
            {execution.isSubtask ? `SubTask(${execution.toolName})` : `Call(${execution.toolName})`}
          </Text>
          <Text>: {argsStr}</Text>
        </Box>
      </Box>
      
      {(displayResult || isError) && (
        <Box marginLeft={4}>
          <Text color="gray">
            {figures.arrowRight} {isError ? execution.error : displayResult} 
            {execution.executionTime && ` (${execution.executionTime}ms)`}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolExecutionVisualizer;