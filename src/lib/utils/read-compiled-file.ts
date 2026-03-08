import { readFile } from 'node:fs/promises';
import { logger } from '$logger';

/**
 * Reads a compiled file from the dist directory.
 * @param options - The options containing output directory and environment variables.
 * @returns The needed environment variables as a record.
 */
export const getEnvironmentNeeded = async (options: {
  outputDirectory: string;
  environment: Record<string, string>;
}): Promise<Record<string, string> | undefined> => {
  const { outputDirectory, environment } = options;
  const outputPath = `${outputDirectory}/src/index.js`;
  try {
    const code = await readFile(outputPath, 'utf-8');
    const needed: Record<string, string> = {};

    const envKeys = Object.keys(environment);
    if (envKeys.length === 0) return undefined;

    // Create a regex that matches any of the environment keys as a standalone word/identifier
    // This handles:
    // 1. process.env.VAR
    // 2. minified.env.VAR
    // 3. getEnv('VAR')
    // 4. env['VAR']
    const escapedKeys = envKeys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'g');

    let match: RegExpExecArray | undefined;
    // biome-ignore lint/suspicious/noAssignInExpressions: valid use case for regex
    while ((match = regex.exec(code) || undefined) !== undefined) {
      const varName = match[1];
      if (environment[varName]) {
        needed[varName] = environment[varName];
      }
    }

    return Object.keys(needed).length > 0 ? needed : undefined;
  } catch (error) {
    logger.debug(`Could not read compiled file at ${outputPath}:`, error);
    return undefined;
  }
};
