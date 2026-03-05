import { exit } from 'node:process';
import { execa } from 'execa';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';

/**
 * Deletes the specified Firebase functions.
 * @param options - The deployment options containing the project ID.
 * @param functionNames - The names of the functions to delete.
 * @returns A promise that resolves when the functions are deleted.
 */
export async function deleteFunctions(
  options: DeployOptions,
  functionNames: string[]
): Promise<void> {
  try {
    await executeFirebaseFunctionsDelete(options, functionNames);
  } catch (error) {
    logger.error('deleteFunctions', error);
    throw error;
  }
}

/**
 * Executes the Firebase CLI command to delete functions.
 * @param options - The deployment options containing the project ID.
 * @param functionNames - The names of the functions to delete.
 * @returns A promise that resolves when the command execution is complete.
 */
async function executeFirebaseFunctionsDelete(options: DeployOptions, functionNames: string[]) {
  logger.info(`Deleting functions: ${functionNames.join(', ')}...`);
  try {
    await execa(
      'firebase',
      ['functions:delete', ...functionNames, '--project', options.projectId!, '--force'],
      {
        stdio: 'inherit',
      }
    );
  } catch (error: unknown) {
    logger.error('Failed to delete functions:');
    logger.error((error as Error).message);
    exit(1);
  }
}
