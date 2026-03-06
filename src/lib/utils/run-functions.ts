/**
 * @file This file contains a function for running multiple functions in parallel with controlled concurrency.
 * @license MIT
 */

/**
 * Runs multiple asynchronous functions in parallel with a maximum concurrency limit.
 * Unlike chunk-based approaches, this uses a worker pool pattern to ensure that
 * as soon as one function finishes, the next one starts, maximizing throughput.
 *
 * @template T - The return type of the functions.
 * @param functions - An array of functions that return promises.
 * @param concurrency - The maximum number of functions to run in parallel. Defaults to 5.
 * @returns A promise that resolves to an array of results in the same order as the input.
 */
export const runFunctions = async <T>(
  functions: (() => Promise<T>)[],
  concurrency = 5
): Promise<T[]> => {
  const results: T[] = new Array(functions.length);
  let currentIndex = 0;

  // Worker function that picks up the next available task
  const worker = async () => {
    while (currentIndex < functions.length) {
      const index = currentIndex++;
      const fn = functions[index];
      if (fn) {
        results[index] = await fn();
      }
    }
  };

  // Launch initial workers up to the concurrency limit
  const workers = Array.from({ length: Math.min(concurrency, functions.length) }, () => worker());

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
};
