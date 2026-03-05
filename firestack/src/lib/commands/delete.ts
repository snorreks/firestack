import { exit } from 'node:process';
import { Command } from 'commander';
import { logger } from '$logger';
import { deleteFunctions } from './delete/utils/delete_functions.js';
import { getOnlineFunctionNames, getUnusedFunctionNames } from './delete/utils/read_functions.js';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';

/**
 * Options for the delete command.
 */
interface DeleteOptions extends DeployOptions {
  all?: boolean;
}

/**
 * The delete command definition.
 */
export const deleteCommand = new Command('delete')
  .description('Deletes all unused Firebase functions.')
  .option('--flavor <flavor>', 'The flavor to use for deletion.', 'development')
  .option('--dry-run', 'Show the deletion commands without executing them.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to delete from.')
  .option('--all', 'Delete all functions in the project.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).',
    'global'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(async (cliOptions: DeleteOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      exit(1);
    }

    const functionsToDelete = cliOptions.all
      ? await getOnlineFunctionNames(options)
      : await getUnusedFunctionNames(options);

    logger.info('Functions to delete:', functionsToDelete);

    if (functionsToDelete.length > 0) {
      if (cliOptions.dryRun) {
        logger.info('Dry run: skipping deletion.');
      } else {
        await deleteFunctions(options, functionsToDelete);
        logger.info('Deletion complete.');
      }
    } else {
      logger.info('No unused functions found.');
    }
  });
