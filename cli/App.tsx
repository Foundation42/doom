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
  const { waitUntilExit } = render(<App />);
  return waitUntilExit();
}

export default App;