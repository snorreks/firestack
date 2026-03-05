import { exit } from 'node:process';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';

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
  const result = await executeCommand('firebase', {
    args: ['functions:delete', ...functionNames, '--project', options.projectId!, '--force'],
    stdio: 'inherit',
    packageManager: options.packageManager,
  });

  if (!result.success) {
    logger.error('Failed to delete functions:');
    logger.error(result.stderr);
    exit(1);
  }
}
