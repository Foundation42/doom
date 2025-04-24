# DOOM: Future Improvements

This document outlines planned enhancements and improvements for the DOOM library.

## Concurrency Control & Backpressure

- [ ] **Flexible Concurrency Management**
  - [ ] Make runtime adjustable concurrency limits based on system load
  - [ ] Implement a proper Promise pool pattern for efficient task scheduling
  - [ ] Add separate concurrency limits for root vs. nested subtasks

- [ ] **Resource Management**
  - [ ] Implement queue-based processing to avoid memory exhaustion
  - [ ] Add backpressure mechanisms for nested subtask fan-out scenarios
  - [ ] Consider integration with p-limit or similar libraries for queue management

## Ordering & Result Aggregation

- [ ] **Deterministic Result Ordering**
  - [ ] Maintain original task order even when executed in parallel
  - [ ] Add option to preserve sequential output order regardless of completion time
  - [ ] Index-based tracking for sorting results post-execution

- [ ] **Partial Failure Handling**
  - [ ] Implement Promise.allSettled for partial failure tolerance
  - [ ] Add structured error reporting for failed subtasks
  - [ ] Support continuing execution despite individual task failures

## Cancellation & Timeouts

- [ ] **Enhanced Abort Signal Propagation**
  - [ ] Ensure proper cancellation across all levels of nested tasks
  - [ ] Add clean shutdown procedures for aborted tasks

- [ ] **Granular Timeout Controls**
  - [ ] Per-tool timeout configuration
  - [ ] Cascading timeout inheritance for subtasks
  - [ ] Support for deadline-based execution (vs. fixed timeouts)

## Observability & Metrics

- [ ] **Advanced Logging**
  - [ ] Add structured logging with context and correlation IDs
  - [ ] Track start/end timestamps for each task execution
  - [ ] Include duration metrics in logs

- [ ] **Performance Metrics**
  - [ ] Export Prometheus-compatible metrics for monitoring
  - [ ] Track error rates, latencies, and throughput 
  - [ ] Add trace context propagation for distributed tracing

## Types & API Surface

- [ ] **Extended ToolResult**
  - [ ] Add optional `error` field for soft failures
  - [ ] Add metadata fields for additional context

- [ ] **Enhanced ParallelConfig**
  - [ ] Add `preserveOrder` flag for deterministic output ordering
  - [ ] Add `retryOnFail` option for automatic retry of failed tasks
  - [ ] Support custom task prioritization

## Testing & Reliability

- [ ] **Comprehensive Test Suite**
  - [ ] Add tests for mixed fast/slow task scenarios
  - [ ] Test error handling and partial failure scenarios
  - [ ] Test mid-flight cancellation behavior

- [ ] **Benchmark Improvements**
  - [ ] Add statistical analysis (mean, median, std dev) to benchmarks
  - [ ] Create reproducible benchmark scenarios
  - [ ] Add comparison tooling for performance regression detection

## CLI & User Experience

- [ ] **Enhanced CLI Interface**
  - [ ] Implement full arrow key history navigation
  - [ ] Add command-line editing with cursor movement
  - [ ] Support for command completion
  - [ ] Add color themes and customization options
  - [x] Display tool calls visually with arguments and results

- [ ] **REPL Improvements**
  - [ ] Save and load conversation sessions
  - [ ] Export conversations to markdown or other formats
  - [ ] Add multi-line input support
  - [ ] Implement proper terminal UI with panels and views

## Documentation & Examples

- [ ] **Advanced Documentation**
  - [ ] Provide best practices for tool implementation
  - [ ] Document error handling patterns
  - [ ] Add detailed API reference

- [ ] **Additional Examples**
  - [ ] Create real-world examples with common APIs
  - [ ] Add examples for error handling and recovery
  - [ ] Provide performance optimization examples