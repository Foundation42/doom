import React from 'react';
import { render, Text } from 'ink';

// Super simple test component
const Test = () => {
  return <Text>Hello, Ink!</Text>;
};

// Render the component
render(<Test />);

// Keep the app running
console.log('Test app is running. Press Ctrl+C to exit.');