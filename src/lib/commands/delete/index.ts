import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { type DeployOptions, getDeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { deleteFunctions } from './utils/delete_functions.js';
import { getOnlineFunctionNames, getUnusedFunctionNames } from './utils/read_functions.js';

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
    const options = await getDeployOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
      );
      exit(1);
    }

    logger.info(chalk.bold.green('🗑️  Starting deletion process...'));

    const functionsToDelete = cliOptions.all
      ? await getOnlineFunctionNames(options)
      : await getUnusedFunctionNames(options);

    if (functionsToDelete.length === 0) {
      logger.info(chalk.green('✅ No unused functions found. Nothing to delete.'));
      return;
    }

    logger.info(
      chalk.cyan(
        `🔍 Found ${chalk.bold(functionsToDelete.length)} function(s) to delete: ${chalk.dim(functionsToDelete.join(', '))}`
      )
    );

    if (cliOptions.dryRun) {
      logger.info(
        chalk.blue(`📝 Dry run: skipping deletion of ${functionsToDelete.length} function(s).`)
      );
      return;
    }

    try {
      await deleteFunctions({ options, functionNames: functionsToDelete });
      logger.info(chalk.bold.green('\n✅ Deletion complete!'));
    } catch (error) {
      logger.error(chalk.red(`\n❌ Failed to delete functions: ${(error as Error).message}`));
      exit(1);
    }
  });
