import React from 'react';
import { render } from 'ink';
import Terminal from './components/Terminal';

/**
 * Main DOOM application component
 */
export function App() {
  return <Terminal />;
}

/**
 * Run the DOOM CLI application
 */
export function runApp() {
  // In Ink v5, render returns an unmount function
  const unmount = render(<App />);
  
  // Keep the process running until user exits
  return new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      unmount();
      resolve();
    });
  });
}

export default App;