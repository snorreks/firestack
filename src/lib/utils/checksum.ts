import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { logger } from '$logger';
import type { ChecksumData } from '$types';

const algorithm = 'md5';
const encoding = 'hex';

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
 * Returns the directory path where checksum files are stored for a given mode.
 * @param options - Options containing output directory and mode.
 * @returns The path to the checksums directory.
 */
const checksumsDirPath = (options: { outputDirectory: string; mode: string }): string =>
  join(options.outputDirectory, '.checksums', options.mode);

/**
 * Loads all cached checksums for a specific mode asynchronously.
 * Reads per-function `.json` files from the checksums directory.
 * Also migrates old monolithic `checksums.json` files.
 */
export const loadChecksums = async (options: {
  outputDirectory: string;
  mode: string;
}): Promise<Record<string, string>> => {
  const dirPath = checksumsDirPath(options);
  const dirExists = await exists({ path: dirPath });
  if (!dirExists) {
    return {};
  }

  const checksums: Record<string, string> = {};

  try {
    // Migrate old monolithic checksums.json if it exists
    const legacyPath = join(dirPath, 'checksums.json');
    if (await exists({ path: legacyPath })) {
      try {
        const legacyContent = await readFile(legacyPath, 'utf-8');
        const legacy = JSON.parse(legacyContent);
        Object.assign(checksums, legacy);
        // Remove the legacy file after migration so it doesn't shadow per-function files
        await rm(legacyPath, { force: true });
      } catch (e) {
        logger.debug('Failed to migrate legacy checksums.json', e);
      }
    }

    // Read per-function checksum files
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      if (extname(entry) !== '.json' || entry === 'checksums.json') {
        continue;
      }
      try {
        const content = await readFile(join(dirPath, entry), 'utf-8');
        const parsed = JSON.parse(content);
        // Per-function files contain { checksum: string, functionName: string }
        if (parsed.checksum && parsed.functionName) {
          checksums[parsed.functionName] = parsed.checksum;
        }
      } catch (e) {
        logger.debug(`Failed to read checksum file ${entry}`, e);
      }
    }
  } catch (e) {
    logger.debug('Failed to load checksums from directory', e);
  }

  return checksums;
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
 * Caches a checksum locally as a per-function JSON file.
 * Each function writes to its own file, eliminating the read-modify-write
 * race condition that occurred with the old monolithic checksums.json.
 * @param data - The function data containing the checksum to cache.
 */
export const cacheChecksumLocal = async (data: ChecksumData): Promise<void> => {
  try {
    const { checksum, functionName } = data;
    if (!checksum) {
      return;
    }

    const dirPath = checksumsDirPath(data);
    await mkdir(dirPath, { recursive: true });

    const filePath = join(dirPath, `${functionName}.json`);
    const fileContent = JSON.stringify({ functionName, checksum }, null, 2);

    logger.debug(`Caching checksum for ${functionName}`, { checksum });

    await writeFile(filePath, fileContent, 'utf-8');
  } catch (error) {
    logger.debug(error);
  }
};
