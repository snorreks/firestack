import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Checks if a file or directory exists.
 * @param path - The path to the file or directory.
 * @returns A promise that resolves to true if it exists, false otherwise.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the entries of a directory.
 * @param path - The path to the directory.
 * @returns A promise that resolves to an array of directory entries.
 */
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

/**
 * Finds the project root by searching for firestack.json or package.json.
 * @returns A promise that resolves to the project root path.
 * @throws An error if the project root cannot be found.
 */
export async function findProjectRoot(): Promise<string> {
  let current = cwd();
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

/**
 * Gets the version of a dependency from the nearest package.json file.
 * Searches from the current working directory upwards.
 *
 * @param dependencyName - The name of the dependency to find.
 * @returns The version string if found, otherwise undefined.
 */
export async function getDependencyVersion(dependencyName: string): Promise<string | undefined> {
  let current = cwd();
  while (true) {
    const pkgPath = join(current, 'package.json');
    if (await exists(pkgPath)) {
      try {
        const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
        const version = pkg.dependencies?.[dependencyName] || pkg.devDependencies?.[dependencyName];
        if (version) return version;
      } catch (_e) {
        // Ignore parsing errors and keep searching
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

/**
 * Opens a URL in the default web browser.
 * @param url - The URL to open.
 */
export async function openUrl(url: string): Promise<void> {
  const { execa } = await import('execa');
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      await execa('cmd', ['/c', 'start', url]);
    } else if (platform === 'darwin') {
      await execa('open', [url]);
    } else {
      await execa('xdg-open', [url]);
    }
  } catch (error) {
    throw new Error(`Failed to open URL: ${(error as Error).message}`);
  }
}
