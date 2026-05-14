import { exit } from 'node:process';
import chalk from 'chalk';
import { logger } from '$logger';
import type { DeleteCommandOptions, FunctionIdentifier } from '$types';
import { executeCommand } from '$utils/command.ts';

export type DeleteFunctionsOptions = {
  deployOptions: DeleteCommandOptions;
  functionNames: FunctionIdentifier[];
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

  // Group functions by region so we can delete per region
  const groupedByRegion = groupFunctionsByRegion(functionNames);

  for (const [region, names] of Object.entries(groupedByRegion)) {
    logger.info(
      chalk.dim(
        `📡 Executing deletion for ${names.length} function(s) in region ${region}: ${names.join(', ')}`
      )
    );

    const args: string[] = [
      'functions:delete',
      ...names,
      '--project',
      deployOptions.projectId,
      '--force',
    ];
    if (region) {
      args.push('--region', region);
    }

    const result = await executeCommand('firebase', {
      args,
      packageManager: deployOptions.packageManager,
    });

    if (!result.success) {
      logger.error(
        `\n❌ Failed to delete functions in region ${region}: ${chalk.bold(names.join(', '))}`
      );
      if (result.stderr) {
        logger.error(chalk.red(result.stderr));
      }
      if (result.stdout && !logger.verbose) {
        logger.error(chalk.dim(result.stdout));
      }
      exit(1);
    }
  }
};

/**
 * Groups function identifiers by region.
 * Returns a map of region → function name array.
 */
const groupFunctionsByRegion = (functionNames: FunctionIdentifier[]): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};

  for (const fn of functionNames) {
    const region = fn.region || 'us-central1';
    if (!grouped[region]) {
      grouped[region] = [];
    }
    grouped[region].push(fn.name);
  }

  return grouped;
};
