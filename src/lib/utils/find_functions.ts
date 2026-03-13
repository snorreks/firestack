import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Recursively finds all function files in a directory in parallel.
 * @param directory - The directory to search.
 * @returns A promise that resolves to an array of file paths.
 */
export const findFunctions = async (directory: string): Promise<string[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    const results = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
          return findFunctions(path);
        }

        if (!entry.isFile()) {
          return [];
        }

        const name = entry.name;

        if (!name.endsWith('.ts') && !name.endsWith('.js')) {
          return [];
        }

        if (
          name.endsWith('.test.ts') ||
          name.endsWith('.spec.ts') ||
          name.endsWith('.test.js') ||
          name.endsWith('.spec.js') ||
          name.endsWith('_test.ts') ||
          name.endsWith('_test.js')
        ) {
          return [];
        }

        return [path];
      })
    );

    return results.flat();
  } catch {
    // Directory doesn't exist
    return [];
  }
};
