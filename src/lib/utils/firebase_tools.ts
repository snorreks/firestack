import { dirname, join } from 'node:path';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';

const PROJECT_FIREBASE_PATHS = [
  'node_modules/firebase-tools/lib/bin/firebase.js',
  'node_modules/.bin/firebase',
];

/**
 * Searches upward from cwd for firebase-tools installed in the user's project.
 * @returns The path and version of firebase-tools, or undefined.
 */
const resolveProjectFirebaseTools = async (): Promise<
  { path: string; version: string } | undefined
> => {
  let current = process.cwd();
  while (true) {
    for (const relativePath of PROJECT_FIREBASE_PATHS) {
      const fullPath = join(current, relativePath);
      if (await exists(fullPath)) {
        const pkgPath = join(current, 'node_modules', 'firebase-tools', 'package.json');
        let version = 'unknown';
        if (await exists(pkgPath)) {
          try {
            const { readFile } = await import('node:fs/promises');
            const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
            version = pkg.version || 'unknown';
          } catch {
            // Ignore parse errors
          }
        }
        return { path: fullPath, version };
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
};

/**
 * Checks for a globally installed firebase command.
 * @returns The version string if found, otherwise undefined.
 */
const resolveGlobalFirebaseVersion = async (): Promise<string | undefined> => {
  try {
    const result = await executeCommand('firebase', {
      args: ['--version'],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.success) {
      const version = result.stdout.trim();
      if (version) {
        return version;
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined;
};

type ResolveFirebaseOptions = {
  cwd?: string;
};

/**
 * Resolves the user's firebase-tools installation.
 * Tries, in order:
 * 1. Project-local firebase-tools (searched upward from cwd)
 * 2. Globally installed firebase command
 * @param options - Resolution options
 * @returns The command, args, and version to run firebase
 */
export const resolveFirebaseCommand = async (
  options: ResolveFirebaseOptions = {}
): Promise<{ cmd: string; args: string[]; version: string }> => {
  if (options.cwd) {
    process.chdir(options.cwd);
  }

  const projectTools = await resolveProjectFirebaseTools();
  if (projectTools) {
    logger.debug(`Using project firebase-tools v${projectTools.version}`);
    const isJsFile = projectTools.path.endsWith('.js');
    return {
      cmd: isJsFile ? 'node' : projectTools.path,
      args: isJsFile ? [projectTools.path] : [],
      version: projectTools.version,
    };
  }

  const globalVersion = await resolveGlobalFirebaseVersion();
  if (globalVersion) {
    logger.debug(`Using global firebase-tools v${globalVersion}`);
    return { cmd: 'firebase', args: [], version: globalVersion };
  }

  throw new Error(
    'firebase-tools not found. Please install it in your project (e.g. bun add -d firebase-tools) or globally (npm install -g firebase-tools).'
  );
};
