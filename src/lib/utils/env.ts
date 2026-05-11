import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';

/**
 * Loads environment variables for scripts.
 * Uses `.env.{mode}` as the base, then overrides with `process.env`.
 * This allows CI pipelines to inject secrets without modifying files.
 * @param options - The options containing the mode.
 * @returns A promise that resolves to the loaded environment variables.
 */
export const getScriptEnvironment = async (options: {
  mode: string;
}): Promise<Record<string, string>> => {
  const { mode } = options;
  const envPath = join(cwd(), `.env.${mode}`);

  const env: Record<string, string> = {};

  // 1. Load from .env.{mode} as the base
  const envExists = await exists(envPath);
  if (envExists) {
    try {
      const envContent = await readFile(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key) {
          env[key] = value;
        }
      }
      logger.debug(`Loaded script environment variables from .env.${mode}`);
    } catch (error) {
      logger.debug(`Failed to read .env.${mode}:`, error);
    }
  } else {
    logger.debug(`.env.${mode} not found, using process.env only.`);
  }

  // 2. Merge process.env on top (CI-friendly override)
  for (const [key, value] of Object.entries(processEnv)) {
    if (value) {
      env[key] = value;
    }
  }

  return env;
};
