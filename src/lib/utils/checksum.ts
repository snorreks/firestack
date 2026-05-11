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
const exists = async (options: { path: string }): Promise<boolean> => {
  try {
    await access(options.path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Returns the path to the checksums file for a given mode.
 * @param options - Options containing output directory and mode.
 * @returns The path to the checksums JSON file.
 */
export const checksumsFilePath = (options: { outputDirectory: string; mode: string }): string =>
  join(options.outputDirectory, '.checksums', options.mode, checksumsFileName);

/**
 * Loads all cached checksums for a specific mode asynchronously.
 */
export const loadChecksums = async (options: {
  outputDirectory: string;
  mode: string;
}): Promise<Record<string, string>> => {
  const path = checksumsFilePath(options);
  const pathExists = await exists({ path });
  if (pathExists) {
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
 * Checks if a function's code or environment has changed.
 * @param options - The function data to check.
 * @returns A promise that resolves to the ChecksumData if changes are detected, or undefined otherwise.
 */
export const checkForChanges = async (options: ChecksumData): Promise<ChecksumData | undefined> => {
  try {
    const { environment, outputRoot } = options;

    const newCode = await readFile(join(outputRoot, 'src/index.js'), 'utf-8');

    const environmentString = environment
      ? Object.entries(environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('')
      : '';

    const allChecksums = options.cachedChecksums ?? (await loadChecksums(options));
    const cachedChecksum = options.checksum ?? allChecksums[options.functionName];
    const newChecksum = generateChecksum(newCode + environmentString);

    if (!options.force && cachedChecksum && cachedChecksum === newChecksum) {
      return undefined;
    }

    options.checksum = newChecksum;
    return options;
  } catch (error) {
    logger.warn(`Error checking for local changes with ${options.functionName}.`);
    logger.debug(error);
    return options;
  }
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
    const folderPath = join(data.outputDirectory, '.checksums', data.mode);

    const folderExists = await exists({ path: folderPath });
    if (!folderExists) {
      await mkdir(folderPath, { recursive: true });
    }

    const allChecksums = await loadChecksums(data);
    allChecksums[functionName] = checksum;

    await writeFile(path, JSON.stringify(allChecksums, null, 2));
  } catch (error) {
    logger.debug(error);
  }
};
