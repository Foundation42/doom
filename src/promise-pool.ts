/**
 * promise-pool.ts
 * 
 * A simple, generic promise pool implementation in TypeScript to limit concurrency
 * when executing an array of async tasks (functions returning a Promise).
 */

/**
 * Executes an array of task functions with a maximum number of concurrent runners.
 *
 * @param tasks - An array of functions, each returning a Promise<T>
 * @param concurrency - Maximum number of tasks to run in parallel
 * @returns A Promise that resolves to an array of results in the same order as tasks
 */
export async function promisePool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 4
): Promise<T[]> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1");
  }

  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  // Worker function that pulls the next task index and runs it
  async function worker() {
    while (true) {
      const idx = currentIndex++;
      if (idx >= tasks.length) break;

      try {
        const result = await tasks[idx]();
        results[idx] = result;
      } catch (err) {
        // Rethrow the error so Promise.all will reject
        throw err;
      }
    }
  }

  // Launch a pool of workers up to the desired concurrency
  const runners = Array(
    Math.min(concurrency, tasks.length)
  )
    .fill(undefined)
    .map(() => worker());

  // Wait for all workers to complete
  await Promise.all(runners);
  return results;
}

/**
 * Executes an array of task functions with a maximum number of concurrent runners.
 * Unlike promisePool, this version doesn't stop execution if one task fails.
 *
 * @param tasks - An array of functions, each returning a Promise<T>
 * @param concurrency - Maximum number of tasks to run in parallel
 * @returns A Promise that resolves to an array of results or errors in the same order as tasks
 */
export async function promisePoolAllSettled<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 4
): Promise<Array<{ status: 'fulfilled', value: T } | { status: 'rejected', reason: any }>> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1");
  }

  const results: Array<{ status: 'fulfilled', value: T } | { status: 'rejected', reason: any }> = new Array(tasks.length);
  let currentIndex = 0;

  // Worker function that pulls the next task index and runs it
  async function worker() {
    while (true) {
      const idx = currentIndex++;
      if (idx >= tasks.length) break;

      try {
        const result = await tasks[idx]();
        results[idx] = { status: 'fulfilled', value: result };
      } catch (err) {
        // Store the error instead of rethrowing
        results[idx] = { status: 'rejected', reason: err };
      }
    }
  }

  // Launch a pool of workers up to the desired concurrency
  const runners = Array(
    Math.min(concurrency, tasks.length)
  )
    .fill(undefined)
    .map(() => worker());

  // Wait for all workers to complete
  await Promise.all(runners);
  return results;
}

/**
 * Options for the parallel execution.
 */
export interface PromisePoolOptions {
  /** Maximum number of concurrent tasks */
  concurrency?: number;
  /** Whether to continue on error (uses allSettled behavior) */
  continueOnError?: boolean;
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Executes an array of task functions with configurable concurrency and error handling.
 *
 * @param tasks - An array of functions, each returning a Promise<T>
 * @param options - Configuration options for the pool
 * @returns A Promise that resolves to an array of results in the same order as tasks
 * @throws Will throw if any task fails and continueOnError is false
 */
export async function executeParallel<T>(
  tasks: Array<() => Promise<T>>,
  options: PromisePoolOptions = {}
): Promise<T[]> {
  const {
    concurrency = 4,
    continueOnError = false,
    signal
  } = options;

  // Early abort if signal is already aborted
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }

  // Handle abort during execution
  let abortController: AbortController | undefined;
  let abortHandler: (() => void) | undefined;
  
  if (signal) {
    abortController = new AbortController();
    abortHandler = () => abortController?.abort();
    signal.addEventListener('abort', abortHandler);
  }

  try {
    if (continueOnError) {
      // Use the allSettled version to continue on error
      const results = await promisePoolAllSettled(tasks, concurrency);
      
      // Extract values or throw the first error encountered
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          if (!continueOnError) {
            throw result.reason;
          }
          // Return a placeholder or null for failed tasks
          return null as unknown as T;
        }
      });
    } else {
      // Use the all-or-nothing version
      return await promisePool(tasks, concurrency);
    }
  } finally {
    // Clean up abort handler
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}