import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';

/**
 * Gets the environment variables for the given flavor.
 * @param flavor The flavor to get the environment variables for.
 * @returns The environment variables.
 */
export async function getEnvironment(flavor: string): Promise<Record<string, string>> {
  const envPath = join(cwd(), `.env.${flavor}`);
  try {
    const envContent = await readFile(envPath, 'utf-8');
    const envVars = envContent.split('\n').reduce(
      (acc, line) => {
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
        if (key && value && !key.startsWith('FIREBASE_SERVICE_ACCOUNT')) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );
    logger.debug(`Loaded environment variables from .env.${flavor}`);
    return envVars;
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.warn(`No .env.${flavor} file found, using default environment variables.`);
      return {};
    }
    throw e;
  }
}
