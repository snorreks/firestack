/**
 * @file This file contains a function for running multiple functions in parallel.
 * @license MIT
 */

/**
 * Runs multiple functions in parallel with a limited concurrency.
 * @param functions - The functions to run.
 * @param concurrency - The maximum number of functions to run in parallel.
 * @returns A promise that resolves to an array of results from the functions.
 */
export const runFunctions = async <T>(
  functions: (() => Promise<T>)[],
  concurrency = 5
): Promise<T[]> => {
  const results: T[] = [];
  let i = 0;

  while (i < functions.length) {
    const chunk = functions.slice(i, i + concurrency);
    i += concurrency;
    results.push(...(await Promise.all(chunk.map((fn) => fn()))));
  }

  return results;
};
