import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';

// --- Configuration ---
/**
 * Keys explicitly blocked from being merged from anywhere.
 * Stripped during deployment to prevent leaking credentials.
 */
const invalidKeys = [
  'FIREBASE_SERVICE_ACCOUNT',
  'GCLOUD_PROJECT',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'PWD',
  'OLDPWD',
  'CI',
  '_',
  'SHLVL',
  'PS1',
  'PS2',
  'SHELL',
  'TERM',
  'TMPDIR',
  'LOGNAME',
  'USER',
  'USERNAME',
  'MAIL',
  'HOSTNAME',
  'DISPLAY',
  'FIREBASE_TOKEN',
];

const dangerousSystemPrefixes = [
  'GITHUB_',
  'RUNNER_',
  'BASH_',
  'ZSH_',
  'LC_',
  'XDG_',
  'SSH_',
  'npm_',
  'NODE_',
  'BUN_',
  'GOCLOUD_',
  'GCLOUD_',
];

const isSafeKey = (key: string): boolean => {
  if (invalidKeys.includes(key)) return false;
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) return false;
  if (dangerousSystemPrefixes.some((prefix) => key.startsWith(prefix))) return false;
  if (key === 'PATH' || key === 'HOME') return false;
  return true;
};
// ----------------------------------------------------------------

/**
 * Helper: Safely reads and parses a .env file into a dictionary.
 * Escapes early on missing files, empty lines, or comments.
 */
const parseEnvFile = async (filePath: string): Promise<Record<string, string> | null> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const result: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [rawKey, ...rest] = trimmed.split('=');
      const key = rawKey.trim();
      if (!key) continue;

      const value = rest
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '');
      result[key] = value;
    }
    return result;
  } catch (error) {
    // 🛡️ Type-safe check for Node's 'ENOENT' (file not found) error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

/**
 * Step 1: Loads the .env.{mode} file and filters out unsafe keys.
 */
const loadModeEnv = async (mode: string): Promise<Record<string, string>> => {
  const envPath = join(cwd(), `.env.${mode}`);
  const rawEnv = await parseEnvFile(envPath);

  if (!rawEnv) {
    logger.debug(`No .env.${mode} file found.`);
    return {};
  }

  const safeEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (!isSafeKey(key)) {
      logger.warn(`Invalid key in .env.${mode}: ${key}. Skipping.`);
      continue;
    }
    safeEnv[key] = value;
  }

  logger.debug(`Loaded environment variables from .env.${mode}`);
  return safeEnv;
};

/**
 * Step 2: Creates an allowlist from .env.example combined with validated mode keys.
 */
const loadAllowlist = async (modeKeys: string[]): Promise<Set<string> | null> => {
  const examplePath = join(cwd(), '.env.example');
  const rawExample = await parseEnvFile(examplePath);

  if (!rawExample) {
    logger.debug(`No .env.example found. Falling back to strict regex filtering for process.env.`);
    return null;
  }

  const allowedKeys = new Set(Object.keys(rawExample));
  for (const key of modeKeys) {
    allowedKeys.add(key);
  }

  logger.debug(`Loaded allowlist from .env.example for process.env merging.`);
  return allowedKeys;
};

/**
 * Step 3: Merges process.env safely using guard clauses.
 */
const mergeProcessEnv = (
  baseEnv: Record<string, string>,
  allowedKeys: Set<string> | null
): Record<string, string> => {
  const finalEnv = { ...baseEnv };

  for (const [key, value] of Object.entries(processEnv)) {
    if (!value) continue;

    // Guard: If we have an allowlist, but the key isn't in it, skip silently.
    if (allowedKeys && !allowedKeys.has(key)) continue;

    // Guard: The key passed the allowlist (or there is no allowlist), but is inherently unsafe.
    if (!isSafeKey(key)) {
      if (allowedKeys) logger.warn(`Invalid key in process.env: ${key}. Skipping.`);
      continue;
    }

    finalEnv[key] = value;
  }

  return finalEnv;
};

/**
 * Gets the environment variables for the given mode.
 *
 * Reads `.env.{mode}` and filters out invalid or system-level keys.
 * Overrides with `process.env` safely by checking `.env.example` (or falling back to strict regex).
 *
 * **Important:** Keys listed in `invalidKeys` (such as `FIREBASE_SERVICE_ACCOUNT`) are
 * intentionally stripped from both the `.env` file and `process.env` to prevent leaking credentials.
 *
 * @param mode - The mode to get the environment variables for.
 * @returns The merged environment variables.
 */
export const getEnvironment = async (mode: string): Promise<Record<string, string>> => {
  const modeEnv = await loadModeEnv(mode);
  const allowedKeys = await loadAllowlist(Object.keys(modeEnv));

  return mergeProcessEnv(modeEnv, allowedKeys);
};
