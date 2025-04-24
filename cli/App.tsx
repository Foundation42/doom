import React from 'react';
import { render } from 'ink';
import Terminal from './components/Terminal.js';

/**
 * Settings for the terminal
 */
export interface TerminalSettings {
  parallel?: boolean;
  showTools?: boolean;
}

/**
 * Main DOOM application component
 */
export function App({ settings }: { settings?: TerminalSettings }) {
  return <Terminal initialSettings={settings} />;
}

/**
 * Run the DOOM CLI application
 */
export function runApp(settings?: TerminalSettings) {
  // Create a resolver for the exit promise
  let resolveExit: () => void;
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  
  // TTY check debug - disabled
  // console.error('Is TTY:', process.stdin.isTTY, 'Raw mode supported:', process.stdin.setRawMode !== undefined);
  
  // In Ink v5, render returns an unmount function
  // Explicitly pass stdin and stdout to ensure raw mode is enabled
  const { unmount, waitUntilExit } = render(<App settings={settings} />, { 
    stdin: process.stdin,
    stdout: process.stdout
  });
  
  // Set up a global exit function that can be called from anywhere
  (global as any).doomExit = () => {
    unmount();
    resolveExit();
  };
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    (global as any).doomExit();
  });
  
  // Wait for exit to be called or terminal to exit
  waitUntilExit().then(() => {
    resolveExit();
  });
  
  return exitPromise;
}

export default App;