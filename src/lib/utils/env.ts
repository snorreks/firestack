import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';

/**
 * Loads environment variables for scripts.
 * Uses `.env.{flavor}` as the base, then overrides with `process.env`.
 * This allows CI pipelines to inject secrets without modifying files.
 * @param options - The options containing the flavor.
 * @returns A promise that resolves to the loaded environment variables.
 */
export const getScriptEnvironment = async (options: {
  flavor: string;
}): Promise<Record<string, string>> => {
  const { flavor } = options;
  const envPath = join(cwd(), `.env.${flavor}`);

  const env: Record<string, string> = {};

  // 1. Load from .env.{flavor} as the base
  const envExists = await exists(envPath);
  if (envExists) {
    try {
      const envContent = await readFile(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const [key, value] = line.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
      logger.debug(`Loaded script environment variables from .env.${flavor}`);
    } catch (error) {
      logger.debug(`Failed to read .env.${flavor}:`, error);
    }
  } else {
    logger.debug(`.env.${flavor} not found, using process.env only.`);
  }

  // 2. Merge process.env on top (CI-friendly override)
  for (const [key, value] of Object.entries(processEnv)) {
    if (value) {
      env[key] = value;
    }
  }

  return env;
};
