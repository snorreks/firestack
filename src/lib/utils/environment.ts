import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';

const invalidKeys = ['FIREBASE_SERVICE_ACCOUNT', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT'] as const;

// Prefixes we NEVER want to pull from process.env into our app deployments
const dangerousSystemPrefixes = ['GITHUB_', 'RUNNER_', 'NPM_', 'BUN_', 'AWS_'];

const isValidKey = (key: string): boolean => {
  // 1. Reject explicitly invalid keys
  if (invalidKeys.includes(key as (typeof invalidKeys)[number])) {
    return false;
  }

  // 2. Reject keys that don't match the strict UPPERCASE_SNAKE_CASE format
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    return false;
  }

  const isDangerous = dangerousSystemPrefixes.some((prefix) => key.startsWith(prefix));
  if (isDangerous || key === 'PATH' || key === 'HOME') {
    return false;
  }

  return true;
};

/**
 * Gets the environment variables for the given flavor.
 * Loads `.env.{flavor}` as the base, then overrides with `process.env`.
 * This allows CI pipelines to inject secrets without modifying files.
 * @param flavor The flavor to get the environment variables for.
 * @returns The merged environment variables.
 */
export const getEnvironment = async (flavor: string): Promise<Record<string, string>> => {
  const envPath = join(cwd(), `.env.${flavor}`);

  let envVars: Record<string, string> = {};

  // 1. Load from .env.{flavor} as the base
  try {
    const envContent = await readFile(envPath, 'utf-8');
    envVars = envContent.split('\n').reduce(
      (acc, line) => {
        const trimmedLine = line.trim(); // Removes \r and accidental whitespace

        // Silently skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return acc;
        }

        const [rawKey, ...rest] = trimmedLine.split('=');
        const key = rawKey.trim();
        let value = rest.join('=').trim();

        // Strip surrounding quotes if present (e.g., VAR="foo" -> foo)
        value = value.replace(/^["']|["']$/g, '');

        if (key && value && isValidKey(key)) {
          acc[key] = value;
        } else if (key) {
          // Only warn if we are actually rejecting a real key attempt
          logger.warn(`⚠️ Skipping invalid Firebase env key from file: ${key}`);
        }

        return acc;
      },
      {} as Record<string, string>
    );
    logger.debug(`Loaded environment variables from .env.${flavor}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug(`No .env.${flavor} file found, using process.env only.`);
    } else {
      throw e;
    }
  }

  // 2. Merge process.env on top (CI-friendly override)
  for (const [key, value] of Object.entries(processEnv)) {
    if (value && isValidKey(key)) {
      envVars[key] = value;
    }
  }

  return envVars;
};
