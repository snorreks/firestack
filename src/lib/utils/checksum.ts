import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '$logger';
import type { ChecksumData } from '$types';

const algorithm = 'md5';
const encoding = 'hex';
const checksumsFileName = 'checksums.json';

/**
 * Checks if a file or directory exists using promises.
 */
const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Returns the path to the checksums file for a given flavor.
 * @param options - Options containing output directory and flavor.
 * @returns The path to the checksums JSON file.
 */
export const checksumsFilePath = (options: { outputDirectory: string; flavor: string }): string =>
  join(options.outputDirectory, '.checksums', options.flavor, checksumsFileName);

/**
 * Loads all cached checksums for a specific flavor asynchronously.
 */
export const loadChecksums = async (options: {
  outputDirectory: string;
  flavor: string;
}): Promise<Record<string, string>> => {
  const path = checksumsFilePath(options);
  if (await exists(path)) {
    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      logger.debug('Failed to parse checksums file', e);
      return {};
    }
  }
  return {};
};

/**
 * Checks if a function's code or environment has changed.
 * @param deployFunction - The function data to check.
 * @returns A promise that resolves to the ChecksumData if changes are detected, or undefined otherwise.
 */
export const checkForChanges = async (
  deployFunction: ChecksumData
): Promise<ChecksumData | undefined> => {
  try {
    const { environment, outputRoot } = deployFunction;

    const newCode = await readFile(join(outputRoot, 'src/index.js'), 'utf-8');

    const environmentString = environment
      ? Object.entries(environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('')
      : '';

    const allChecksums = await loadChecksums(deployFunction);
    const cachedChecksum = deployFunction.checksum ?? allChecksums[deployFunction.functionName];
    const newChecksum = generateChecksum(newCode + environmentString);

    if (!deployFunction.force && cachedChecksum && cachedChecksum === newChecksum) {
      logger.info(`${deployFunction.functionName} has not changed, skipping deployment`);
      return undefined;
    }

    deployFunction.checksum = newChecksum;
    return deployFunction;
  } catch (error) {
    logger.warn(`Error checking for local changes with ${deployFunction.functionName}.`);
    logger.debug(error);
    return deployFunction;
  }
};

/**
 * Generates a checksum for the given code.
 * @param code - The code to hash.
 * @returns The generated checksum string.
 */
const generateChecksum = (code: string): string => {
  const hash = createHash(algorithm);
  hash.update(code);
  return hash.digest(encoding);
};

/**
 * Caches a checksum locally in the consolidated JSON file.
 * @param data - The function data containing the checksum to cache.
 */
export const cacheChecksumLocal = async (data: ChecksumData): Promise<void> => {
  try {
    const { checksum, functionName } = data;
    logger.debug(`Caching checksum for ${functionName}`, {
      checksum,
    });
    if (!checksum) {
      return;
    }

    const path = checksumsFilePath(data);
    const folderPath = join(data.outputDirectory, '.checksums', data.flavor);

    if (!(await exists(folderPath))) {
      await mkdir(folderPath, { recursive: true });
    }

    const allChecksums = await loadChecksums(data);
    allChecksums[functionName] = checksum;

    await writeFile(path, JSON.stringify(allChecksums, null, 2));
  } catch (error) {
    logger.debug(error);
  }
};
