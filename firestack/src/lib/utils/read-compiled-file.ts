import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '$logger';

/**
 * Filters the environment record to only include keys found in the compiled code.
 * @param outputRoot - The output root directory where the compiled code is located.
 * @param environment - A record of environment variables.
 * @returns A promise that resolves to the filtered environment record or undefined.
 */
export const getEnvironmentNeeded = async (
  outputRoot: string,
  environment: Record<string, string>
): Promise<Record<string, string> | undefined> => {
  try {
    if (!environment) {
      return;
    }
    const outputPath = join(outputRoot, 'src/index.js');
    const code = readFileSync(outputPath, 'utf-8');

    return Object.fromEntries(Object.entries(environment).filter(([key]) => code.includes(key)));
  } catch (error) {
    logger.error('getEnvironmentKeysNeeded', error);
    return;
  }
};
