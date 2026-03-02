import { execa } from 'execa';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { exitCode } from '$utils/node-shim.js';

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
    exitCode(1);
  }
}
