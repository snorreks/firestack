import { dirname } from 'node:path';
import { cwdDir, readDir } from '../node-shim.js';

export async function findProjectRoot(): Promise<string> {
  let current = cwdDir();
  while (true) {
    const entries = await readDir(current);
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === 'firestack.json' || entry.name === 'package.json')) {
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not find project root. Make sure you are in a firestack project.');
    }
    current = parent;
  }
}
