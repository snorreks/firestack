import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';

const PROJECT_FIREBASE_PATHS = [
  'node_modules/firebase-tools/lib/bin/firebase.js',
  'node_modules/.bin/firebase',
];

/**
 * Resolves firebase-tools by checking relative to the firestack package itself.
 * Bun hoists packages flat in a cache directory, so the traditional
 * walk-up-from-cwd approach fails. This method uses the firestack package's
 * own location to find its firebase-tools dependency via require.resolve.
 * @returns The path and version of firebase-tools, or undefined.
 */
const resolveFirebaseFromFirestack = async (): Promise<
  { path: string; version: string } | undefined
> => {
  try {
    const firestackPath = require.resolve('@snorreks/firestack');
    const firestackDir = dirname(firestackPath);
    const fbPath = join(firestackDir, '..', '..', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    if (await exists(fbPath)) {
      const pkgPath = join(firestackDir, '..', '..', 'firebase-tools', 'package.json');
      let version = 'unknown';
      if (await exists(pkgPath)) {
        try {
          const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
          version = pkg.version || 'unknown';
        } catch {
          // Ignore parse errors
        }
      }
      return { path: fbPath, version };
    }
  } catch {
    // firestack package not resolvable — non-standard setup
  }
  return undefined;
};

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
 * Checks for a globally installed firebase command using execSync directly.
 * Uses execSync (not executeCommand) to avoid recursive resolveFirebaseCommand calls.
 * @returns The version string if found, otherwise undefined.
 */
const resolveGlobalFirebaseVersion = async (): Promise<string | undefined> => {
  try {
    const stdout = execSync('firebase --version', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    }).trim();
    if (stdout) {
      return stdout;
    }
  } catch {
    // firebase not found globally
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
 * 2. Firestack-bundled firebase-tools (handles bun flat cache layout)
 * 3. Globally installed firebase command (via execSync, no recursion)
 * @param options - Resolution options
 * @returns The command, args, and version to run firebase
 */
export const resolveFirebaseCommand = async (
  options: ResolveFirebaseOptions = {}
): Promise<{ cmd: string; args: string[]; version: string }> => {
  if (options.cwd) {
    process.chdir(options.cwd);
  }

  // 1. Project-local firebase-tools (hoisted or traditional node_modules)
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

  // 2. Firestack-bundled firebase-tools (handles bun flat cache layout)
  const bundledTools = await resolveFirebaseFromFirestack();
  if (bundledTools) {
    logger.debug(`Using firestack-bundled firebase-tools v${bundledTools.version}`);
    return {
      cmd: 'node',
      args: [bundledTools.path],
      version: bundledTools.version,
    };
  }

  // 3. Globally installed firebase command
  const globalVersion = await resolveGlobalFirebaseVersion();
  if (globalVersion) {
    logger.debug(`Using global firebase-tools v${globalVersion}`);
    return { cmd: 'firebase', args: [], version: globalVersion };
  }

  throw new Error(
    'firebase-tools not found. Please install it in your project (e.g. bun add -d firebase-tools) or globally (npm install -g firebase-tools).'
  );
};
