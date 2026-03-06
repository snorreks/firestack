import { exit } from 'node:process';
import chalk from 'chalk';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';

export interface DeleteFunctionsOptions {
  options: DeployOptions;
  functionNames: string[];
}

/**
 * Deletes the specified Firebase functions.
 */
export async function deleteFunctions(opts: DeleteFunctionsOptions): Promise<void> {
  const { options, functionNames } = opts;
  try {
    await executeFirebaseFunctionsDelete({ options, functionNames });
  } catch (error) {
    logger.error('deleteFunctions', error);
    throw error;
  }
}

/**
 * Executes the Firebase CLI command to delete functions.
 */
async function executeFirebaseFunctionsDelete(opts: DeleteFunctionsOptions) {
  const { options, functionNames } = opts;
  if (!options.projectId) {
    throw new Error('Project ID is required for delete command.');
  }

  logger.info(chalk.dim(`📡 Executing deletion for: ${functionNames.join(', ')}`));
  const result = await executeCommand('firebase', {
    args: ['functions:delete', ...functionNames, '--project', options.projectId, '--force'],
    packageManager: options.packageManager,
  });

  if (!result.success) {
    logger.error(`\n❌ Failed to delete functions: ${chalk.bold(functionNames.join(', '))}`);
    if (result.stderr) {
      logger.error(chalk.red(result.stderr));
    }
    if (result.stdout && !options.verbose) {
      logger.error(chalk.dim(result.stdout));
    }
    exit(1);
  }
}
