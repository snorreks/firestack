import { readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cwd } from 'node:process';

function cwdDir(): string {
  return cwd();
}

async function readDir(
  path: string
): Promise<{ name: string; isDirectory: () => boolean; isFile: () => boolean }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory(),
    isFile: () => entry.isFile(),
  }));
}

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
