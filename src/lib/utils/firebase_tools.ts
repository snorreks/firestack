import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';

const FIREBASE_TOOLS_CACHE_DIR = join(homedir(), '.cache', 'firestack', 'firebase-tools');
const ISOLATED_FIREBASE_BINARY = join(FIREBASE_TOOLS_CACHE_DIR, 'node_modules', '.bin', 'firebase');

/**
 * Resolves firebase-tools from firestack's own node_modules.
 * @returns The path to the firebase binary, or undefined if not found.
 */
const resolveBundledFirebaseTools = (): string | undefined => {
  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve('firebase-tools/package.json');
    return join(packageJsonPath, '..', 'lib', 'bin', 'firebase.js');
  } catch {
    return undefined;
  }
};

/**
 * Installs firebase-tools in an isolated cache directory.
 * @returns The path to the installed firebase binary.
 */
const installIsolatedFirebaseTools = async (): Promise<string> => {
  logger.info('Installing isolated firebase-tools (this may take a moment)...');

  await executeCommand('npm', {
    args: ['init', '-y'],
    cwd: FIREBASE_TOOLS_CACHE_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const result = await executeCommand('npm', {
    args: ['install', 'firebase-tools'],
    cwd: FIREBASE_TOOLS_CACHE_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (!result.success) {
    throw new Error(`Failed to install isolated firebase-tools: ${result.stderr}`);
  }

  logger.info('Isolated firebase-tools installed successfully.');
  return ISOLATED_FIREBASE_BINARY;
};

type ResolveFirebaseOptions = {
  preferIsolated?: boolean;
};

/**
 * Resolves the path to the firebase binary.
 * Tries, in order:
 * 1. Firestack's bundled firebase-tools
 * 2. Isolated cache installation
 * 3. System PATH
 * @param options - Resolution options
 * @returns The command and args to run firebase
 */
export const resolveFirebaseCommand = async (
  options: ResolveFirebaseOptions = {}
): Promise<{ cmd: string; args: string[] }> => {
  const { preferIsolated = false } = options;

  if (!preferIsolated) {
    const bundledPath = resolveBundledFirebaseTools();
    if (bundledPath && (await exists(bundledPath))) {
      logger.debug('Using bundled firebase-tools');
      return { cmd: 'node', args: [bundledPath] };
    }
  }

  if ((await exists(ISOLATED_FIREBASE_BINARY)) || preferIsolated) {
    if (!(await exists(ISOLATED_FIREBASE_BINARY))) {
      await installIsolatedFirebaseTools();
    }
    logger.debug('Using isolated firebase-tools');
    return { cmd: 'node', args: [ISOLATED_FIREBASE_BINARY] };
  }

  logger.debug('Using system firebase from PATH');
  return { cmd: 'firebase', args: [] };
};
