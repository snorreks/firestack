import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { PackageManager } from '$types';
import { getDeleteOptions } from '$utils/options.ts';
import { deleteFunctions } from './utils/delete_functions.ts';
import { getOnlineFunctionNames, getUnusedFunctionNames } from './utils/read_functions.ts';

type DeleteOptions = {
  mode?: string;
  projectId?: string;
  packageManager?: PackageManager;
  external?: string[];
  verbose?: boolean;
  all?: boolean;
  dryRun?: boolean;
};

/**
 * The delete command definition.
 */
export const deleteCommand = new Command('delete')
  .description('Deletes all unused Firebase functions.')
  .option('--mode <mode>', 'The mode to use for deletion.')
  .option('--dry-run', 'Show the deletion commands without executing them.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to delete from.')
  .option('--all', 'Delete all functions in the project.')
  .option('--minify', 'Will minify the functions.')
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .action(async (cliOptions: DeleteOptions) => {
    const deployOptions = await getDeleteOptions(cliOptions);

    logger.info(chalk.bold.green('🗑️  Starting deletion process...'));

    const functionsToDelete = cliOptions.all
      ? await getOnlineFunctionNames(deployOptions)
      : await getUnusedFunctionNames(deployOptions);

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
      await deleteFunctions({
        deployOptions,
        functionNames: functionsToDelete,
      });
      logger.info(chalk.bold.green('\n✅ Deletion complete!'));
    } catch (error) {
      logger.error(chalk.red(`\n❌ Failed to delete functions: ${(error as Error).message}`));
      exit(1);
    }
  });
