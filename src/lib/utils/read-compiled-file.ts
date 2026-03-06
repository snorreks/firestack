import { readFile } from 'node:fs/promises';
import { logger } from '$logger';

/**
 * Reads a compiled file from the dist directory.
 * @param outputPath The path to the compiled file.
 * @returns The contents of the file as a string.
 */
export async function getEnvironmentNeeded(
  outputDir: string,
  environment: Record<string, string>
): Promise<Record<string, string> | undefined> {
  const outputPath = `${outputDir}/src/index.js`;
  try {
    const code = await readFile(outputPath, 'utf-8');
    const needed: Record<string, string> = {};

    // Look for process.env.VARIABLE in the code
    const regex = /process\.env\.([a-zA-Z0-9_]+)/g;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: valid use case for regex
    while ((match = regex.exec(code)) !== null) {
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
}
