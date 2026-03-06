import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Recursively finds all function files in a directory in parallel.
 * @param dir - The directory to search.
 * @returns A promise that resolves to an array of file paths.
 */
export async function findFunctions(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    const results = await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
          return findFunctions(path);
        }

        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const name = entry.name;
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
        }

        return [];
      })
    );

    return results.flat();
  } catch {
    // Directory doesn't exist
    return [];
  }
}
