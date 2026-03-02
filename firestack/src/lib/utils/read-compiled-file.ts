import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    console.error('getEnvironmentKeysNeeded', error);
    return;
  }
};
