import { exit } from 'node:process';
import chalk from 'chalk';
import type { DeployOptions } from '$commands/deploy/utils/options.ts';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.ts';

export type DeleteFunctionsOptions = {
  deployOptions: DeployOptions;
  functionNames: string[];
};

/**
 * Deletes the specified Firebase functions.
 */
export const deleteFunctions = async (options: DeleteFunctionsOptions): Promise<void> => {
  const { deployOptions, functionNames } = options;
  try {
    await executeFirebaseFunctionsDelete({ deployOptions, functionNames });
  } catch (error) {
    logger.error('deleteFunctions', error);
    throw error;
  }
};

/**
 * Executes the Firebase CLI command to delete functions.
 */
const executeFirebaseFunctionsDelete = async (options: DeleteFunctionsOptions) => {
  const { deployOptions, functionNames } = options;
  if (!deployOptions.projectId) {
    throw new Error('Project ID is required for delete command.');
  }

  logger.info(chalk.dim(`📡 Executing deletion for: ${functionNames.join(', ')}`));
  const result = await executeCommand('firebase', {
    args: ['functions:delete', ...functionNames, '--project', deployOptions.projectId, '--force'],
    packageManager: deployOptions.packageManager,
  });

  if (!result.success) {
    logger.error(`\n❌ Failed to delete functions: ${chalk.bold(functionNames.join(', '))}`);
    if (result.stderr) {
      logger.error(chalk.red(result.stderr));
    }
    if (result.stdout && !logger.verbose) {
      logger.error(chalk.dim(result.stdout));
    }
    exit(1);
  }
};
