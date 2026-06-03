import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { GenerateCliOptions } from '$types';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';
import { getGenerateOptions } from '$utils/options.ts';

/**
 * Main action for the generate command.
 * Generates Data Connect SDKs from local schema files.
 * @param cliOptions - The options provided via CLI
 */
export const generateAction = async (cliOptions: GenerateCliOptions) => {
  const generateOptions = await getGenerateOptions(cliOptions);

  if (!generateOptions.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack config.'
      )
    );
    exit(1);
  }

  const projectRoot = cwd();
  const dataconnectDir = join(projectRoot, generateOptions.dataconnectDirectory);

  if (!(await exists(dataconnectDir))) {
    logger.error(
      chalk.red(
        `Data Connect directory not found at ${chalk.bold(generateOptions.dataconnectDirectory)}.`
      )
    );
    exit(1);
  }

  const isWatchMode = generateOptions.watch;

  logger.info(
    chalk.cyan(`🔗 ${isWatchMode ? 'Watching and generating' : 'Generating'} Data Connect SDKs...`)
  );

  const commandArgs = ['dataconnect:sdk:generate'];

  if (isWatchMode) {
    commandArgs.push('--watch');
  }

  if (generateOptions.projectId) {
    commandArgs.push('--project', generateOptions.projectId);
  }

  logger.debug(`Running: firebase ${commandArgs.join(' ')}`);
  logger.debug(`Working directory: ${projectRoot}`);

  const result = await executeCommand('firebase', {
    args: commandArgs,
    cwd: projectRoot,
    packageManager: generateOptions.packageManager,
  });

  if (!result.success) {
    if (isWatchMode) {
      logger.error(chalk.red('❌ Data Connect SDK watch ended unexpectedly.'));
    } else {
      logger.error(chalk.red('❌ Failed to generate Data Connect SDKs.'));
      if (result.stderr) {
        logger.debug(`Error: ${result.stderr}`);
      }
    }
    return;
  }

  if (!isWatchMode) {
    logger.info(chalk.bold.green('✅ Data Connect SDKs generated successfully.'));
  }
};

/**
 * The generate command definition.
 */
export const generateCommand = new Command('generate')
  .description('Generates Data Connect SDKs from local schema files.')
  .option('--mode <mode>', 'The mode to use for generation.')
  .option('--projectId <projectId>', 'The Firebase project ID.')
  .option('--watch', 'Watch Data Connect schema files and regenerate SDKs on changes.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .option(
    '--dataconnectDirectory <dataconnectDirectory>',
    'The directory containing the Data Connect configuration.'
  )
  .action(generateAction);
