import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import { exists } from '$utils/common.js';

/**
 * Loads environment variables from a .env file.
 * @param flavor The flavor to load.
 * @returns A promise that resolves to the loaded environment variables.
 */
export async function getScriptEnvironment(flavor: string): Promise<Record<string, string>> {
  const envPath = join(cwd(), `.env.${flavor}`);

  if (!(await exists(envPath))) {
    logger.debug(`.env.${flavor} not found`);
    return {};
  }

  try {
    const envContent = await readFile(envPath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of envContent.split('\n')) {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }

    return env;
  } catch (error) {
    logger.debug(`Failed to read .env.${flavor}:`, error);
    return {};
  }
}
