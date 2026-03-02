import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logger.js';

export async function getScriptEnvironment(flavor: string): Promise<Record<string, string>> {
  const envPath = join(process.cwd(), `.env.${flavor}`);
  try {
    if (!existsSync(envPath)) {
      logger.debug(`.env.${flavor} file not found, continuing without it.`);
      return {};
    }
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    let currentKey = '';
    let currentValue = '';

    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) {
        if (currentKey) {
          env[currentKey] = currentValue;
        }
        currentKey = match[1];
        currentValue = match[2];
      } else {
        currentValue += `\n${line}`;
      }
    }
    if (currentKey) {
      env[currentKey] = currentValue;
    }
    return env;
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.warn(`No .env.${flavor} file found, continuing without it.`);
      return {};
    }
    throw e;
  }
}
