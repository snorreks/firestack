import { join } from 'node:path';
import { readDir } from '$utils/node-shim.js';

export async function findFunctions(dir: string): Promise<string[]> {
  const functions: string[] = [];
  try {
    const entries = await readDir(dir);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        functions.push(...(await findFunctions(path)));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const name = entry.name;
        if (
          name.endsWith('.test.ts') ||
          name.endsWith('.spec.ts') ||
          name.endsWith('.test.js') ||
          name.endsWith('.spec.js') ||
          name.endsWith('_test.ts') ||
          name.endsWith('_test.js')
        ) {
          continue;
        }
        functions.push(path);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return functions;
}
