import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';

export type DataconnectFile = {
  /** Full path to the file */
  path: string;
  /** Relative path from the dataconnect directory */
  relativePath: string;
};

type FindDataconnectFilesOptions = {
  dataconnectDirectory: string;
};

/**
 * Recursively finds all dataconnect-related source files in the given directory.
 * Includes .yaml and .gql files.
 * @param options - Configuration options
 * @returns A list of dataconnect files found
 */
export const findDataconnectFiles = async (
  options: FindDataconnectFilesOptions
): Promise<DataconnectFile[]> => {
  const { dataconnectDirectory } = options;
  const files: DataconnectFile[] = [];

  try {
    if (!(await exists(dataconnectDirectory))) {
      logger.debug(`Dataconnect directory ${dataconnectDirectory} not found`);
      return files;
    }

    await collectFiles(dataconnectDirectory, dataconnectDirectory, files);
  } catch (error) {
    logger.debug(`Error scanning dataconnect directory: ${(error as Error).message}`);
  }

  return files;
};

/**
 * Recursively collects .yaml and .gql files.
 */
const collectFiles = async (
  rootDir: string,
  currentDir: string,
  files: DataconnectFile[]
): Promise<void> => {
  let entries: Dirent[];
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories
      if (entry.name.startsWith('.')) {
        continue;
      }
      await collectFiles(rootDir, fullPath, files);
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith('.yaml') ||
        entry.name.endsWith('.gql') ||
        entry.name.endsWith('.graphql'))
    ) {
      files.push({
        path: fullPath,
        relativePath: relative(rootDir, fullPath),
      });
    }
  }
};

/**
 * Generates a checksum for all dataconnect files by hashing their combined content.
 * @param files - The list of dataconnect files
 * @returns A hex checksum string
 */
export const generateDataconnectChecksum = async (files: DataconnectFile[]): Promise<string> => {
  const { createHash } = await import('node:crypto');

  // Sort files by relative path for deterministic checksums
  const sorted = [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hash = createHash('md5');

  for (const file of sorted) {
    hash.update(file.relativePath);
    try {
      const content = await readFile(file.path, 'utf-8');
      hash.update(content);
    } catch {
      logger.debug(`Failed to read ${file.path} for checksum generation`);
    }
  }

  return hash.digest('hex');
};

/**
 * Extracts location and serviceId from dataconnect.yaml.
 * @param dataconnectDirectory - The dataconnect directory path
 * @returns An object with location and serviceId if found
 */
export const readDataconnectYaml = async (
  dataconnectDirectory: string
): Promise<{ location?: string; serviceId?: string }> => {
  const yamlPath = join(dataconnectDirectory, 'dataconnect.yaml');

  try {
    const content = await readFile(yamlPath, 'utf-8');
    const locationMatch = content.match(/location:\s*(.+)/);
    const serviceIdMatch = content.match(/serviceId:\s*(.+)/);

    return {
      location: locationMatch?.[1]?.trim(),
      serviceId: serviceIdMatch?.[1]?.trim(),
    };
  } catch {
    return {};
  }
};
