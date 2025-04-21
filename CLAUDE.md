# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build` (compiles TypeScript)
- Lint: `npm run lint` (runs ESLint)
- Test: `npm test` (runs all tests)
- Run single test: `npm test -- -t "test name"`
- Run REPL: `npm run repl` (interactive tool demo)
- Run subtasks example: `npm run subtasks`

## Code Style Guidelines
- TypeScript with strong typing and explicit return types
- 2-space indentation, single quotes, semicolons
- camelCase for variables/functions, PascalCase for interfaces
- JSDoc comments for all functions and interfaces
- Imports: external first, then local imports
- Error handling: explicit checks, proper propagation, retry logic
- Async patterns: async/await with try/catch blocks
- Use AbortSignal for cancellation support
- Timeouts: explicit handling with AbortController
- JSON parsing: Use safeParseArgs for handling tool arguments

## Subtasks Pattern
When implementing tools, return ToolResult objects to trigger automatic subtasks:
```typescript
return {
  output: "Primary tool output text",
  subTasks: [
    { toolName: "anotherTool", args: { param1: "value" } },
    { toolName: "yetAnotherTool", args: { param2: 123 } }
  ]
};
```
This will automatically execute the subtasks in sequence and include their results in the conversation.