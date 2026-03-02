import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChecksumData } from '$types';

const algorithm = 'md5';
const encoding = 'hex';
const checksumsFolderName = '.checksums';

export const checksumsFolderPath = (options: { outputDirectory: string; flavor: string }): string =>
  join(options.outputDirectory, checksumsFolderName, options.flavor);

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
      console.log(
        `%c${deployFunction.functionName} has not changed, skipping deployment`,
        'color: green'
      );
      return undefined;
    }

    deployFunction.checksum = newChecksum;
    return deployFunction;
  } catch (error) {
    console.warn(
      `%cError checking for local changes with ${deployFunction.functionName}.`,
      'color: yellow'
    );
    console.debug(error);
    return deployFunction;
  }
};

const generateChecksum = (code: string): string => {
  const hash = createHash(algorithm);
  hash.update(code);
  return hash.digest(encoding);
};

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
    console.debug(error);
    return;
  }
};

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
    console.debug(error);
  }
};
