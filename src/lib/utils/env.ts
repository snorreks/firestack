import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';

/**
 * Loads environment variables from a .env file.
 * @param options - The options containing the flavor.
 * @returns A promise that resolves to the loaded environment variables.
 */
export const getScriptEnvironment = async (options: {
  flavor: string;
}): Promise<Record<string, string>> => {
  const { flavor } = options;
  const envPath = join(cwd(), `.env.${flavor}`);

  const envExists = await exists(envPath);
  if (!envExists) {
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
};
