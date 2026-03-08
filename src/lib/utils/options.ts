import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import type { FirestackConfig } from '$lib/commands/deploy/utils/options';
import { logger } from '$logger';

export const getFirestackConfig = async (): Promise<FirestackConfig> => {
  const configPath = join(cwd(), 'firestack.json');
  let config: FirestackConfig = {};
  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);
    logger.debug(`Using configuration from ${configPath}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug('firestack.json not found, using command-line options.');
    } else {
      logger.error(`Failed to read firestack.json at ${configPath}: ${error.message}`);
      throw error;
    }
  }

  return config;
};
