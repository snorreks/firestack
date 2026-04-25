import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';

const invalidKeys = ['FIREBASE_SERVICE_ACCOUNT', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT'] as const;

const isValidKey = (key: string) => !invalidKeys.includes(key as (typeof invalidKeys)[number]);

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
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
        if (key && value && isValidKey(key)) {
          acc[key] = value;
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
