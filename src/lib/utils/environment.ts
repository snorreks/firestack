import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';

// --- Fallback Configuration (Used if .env.example is missing) ---
/**
 * Keys that are explicitly blocked from being merged from `process.env`.
 * These are typically system-level or sensitive variables that should not
 * be included in the deployed environment.
 *
 * @example
 * `FIREBASE_SERVICE_ACCOUNT` is blocked because it is only needed for local
 * script execution (e.g., running admin scripts against Firebase). Since it
 * is in this list, it will be stripped during deployment, so you can safely
 * keep it in your local `.env` without worrying about leaking credentials.
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

const isSafeFallbackKey = (key: string): boolean => {
  if (invalidKeys.includes(key)) return false;
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) return false;
  if (dangerousSystemPrefixes.some((prefix) => key.startsWith(prefix))) return false;
  if (key === 'PATH' || key === 'HOME') return false;
  return true;
};
// ----------------------------------------------------------------

/**
 * Gets the environment variables for the given flavor.
 *
 * Reads `.env.{flavor}` without key restrictions.
 * Overrides with `process.env` safely by checking `.env.example` (or falling back to strict regex).
 *
 * **Important:** Keys listed in `invalidKeys` (such as `FIREBASE_SERVICE_ACCOUNT`) are
 * intentionally stripped from `process.env` during deployment. This means you can keep
 * sensitive or local-only variables in your environment without them being shipped.
 *
 * **Best practice:** Keep `FIREBASE_SERVICE_ACCOUNT` in your local `.env` file so you
 * can run local admin scripts, but rest assured it will be excluded from the deployed
 * environment because it is present in the `invalidKeys` blocklist.
 *
 * @param flavor - The flavor to get the environment variables for.
 * @returns The merged environment variables.
 */
export const getEnvironment = async (flavor: string): Promise<Record<string, string>> => {
  const envPath = join(cwd(), `.env.${flavor}`);
  const examplePath = join(cwd(), '.env.example');

  const envVars: Record<string, string> = {};

  // 1. Load `.env.{flavor}` freely
  try {
    const envContent = await readFile(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const [rawKey, ...rest] = trimmedLine.split('=');
      const key = rawKey.trim();

      if (key && isSafeFallbackKey(key)) {
        let value = rest.join('=').trim();
        value = value.replace(/^["']|["']$/g, ''); // Strip surrounding quotes
        envVars[key] = value;
      } else {
        logger.warn(`Invalid key in .env.${flavor}: ${key}. Skipping.`);
      }
    }
    logger.debug(`Loaded environment variables from .env.${flavor}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug(`No .env.${flavor} file found.`);
    } else {
      throw e;
    }
  }

  // 2. Determine Allowlist for process.env
  let allowedKeys: Set<string> | null = null;
  try {
    const exampleContent = await readFile(examplePath, 'utf-8');
    allowedKeys = new Set<string>();

    // Grab keys from .env.example
    for (const line of exampleContent.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const key = trimmedLine.split('=')[0].trim();
      if (key) allowedKeys.add(key);
    }

    // Also explicitly allow any keys we just parsed from .env.{flavor}
    for (const key of Object.keys(envVars)) {
      allowedKeys.add(key);
    }

    logger.debug(`Loaded allowlist from .env.example for process.env merging.`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code !== 'ENOENT') throw e;
    // We intentionally leave allowedKeys as `null` here to trigger the fallback logic below
    logger.debug(`No .env.example found. Falling back to strict regex filtering for process.env.`);
  }

  // 3. Merge process.env safely
  for (const [key, value] of Object.entries(processEnv)) {
    if (!value) continue;

    if (allowedKeys) {
      // ✅ Allowlist approach (Preferred)
      if (allowedKeys.has(key)) {
        if (!isSafeFallbackKey(key)) {
          logger.warn(`Invalid key in process.env: ${key}. Skipping.`);
          continue;
        }
        envVars[key] = value;
      }
    } else if (isSafeFallbackKey(key)) {
      envVars[key] = value;
    }
  }

  return envVars;
};
