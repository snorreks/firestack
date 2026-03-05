import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '$logger';
import type { ChecksumData } from '$types';

const algorithm = 'md5';
const encoding = 'hex';
const checksumsFolderName = '.checksums';

/**
 * Returns the path to the checksums folder.
 * @param options - Options containing output directory and flavor.
 * @returns The path to the checksums folder.
 */
export const checksumsFolderPath = (options: { outputDirectory: string; flavor: string }): string =>
  join(options.outputDirectory, checksumsFolderName, options.flavor);

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

    const newCode = readFileSync(join(outputRoot, 'src/index.js'), 'utf-8');

    const environmentString = environment
      ? Object.entries(environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('')
      : '';
    const cachedChecksum = deployFunction.checksum ?? (await getCachedChecksum(deployFunction));
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
 * Retrieves the cached checksum for a function.
 * @param data - The function data.
 * @returns A promise that resolves to the cached checksum or undefined.
 */
const getCachedChecksum = async ({
  outputDirectory,
  functionName,
  flavor,
}: ChecksumData): Promise<string | undefined> => {
  try {
    const checksumFileName = `${functionName}.${algorithm}`;
    const checksumPath = join(checksumsFolderPath({ outputDirectory, flavor }), checksumFileName);
    if (existsSync(checksumPath)) {
      return readFileSync(checksumPath, 'utf-8');
    }
    return undefined;
  } catch (error) {
    logger.debug(error);
    return;
  }
};

/**
 * Caches a checksum locally.
 * @param data - The function data containing the checksum to cache.
 * @returns A promise that resolves when the checksum is cached.
 */
export const cacheChecksumLocal = async ({
  outputDirectory,
  checksum,
  flavor,
  functionName,
}: ChecksumData): Promise<void> => {
  try {
    if (!checksum) {
      return;
    }
    const checksumFileName = `${functionName}.${algorithm}`;
    const folderPath = checksumsFolderPath({ outputDirectory, flavor });
    mkdirSync(folderPath, { recursive: true });

    writeFileSync(join(folderPath, checksumFileName), checksum);
  } catch (error) {
    logger.debug(error);
  }
};
