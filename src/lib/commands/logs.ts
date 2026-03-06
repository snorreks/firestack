import chalk from 'chalk';
import { Command } from 'commander';
import { type DeployOptions, getOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';

/**
 * Options specifically for the logs command.
 */
interface LogsOptions extends DeployOptions {
  only?: string;
  lines?: string;
  since?: string;
  open?: boolean;
}

/**
 * Command definition to view Firebase Cloud Functions logs.
 */
export const logsCommand = new Command('logs')
  .description('View logs from Firebase Cloud Functions.')
  .option('--flavor <flavor>', 'The flavor to use for logs.', 'development')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID.')
  .option('--only <only>', 'Only show logs for specific function(s).')
  .option('-n, --lines <lines>', 'Number of log lines to fetch.', '50')
  .option('--since <since>', 'Only show logs after this time (e.g., "1h", "30m").')
  .option('--open', 'Open logs in web browser.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).',
    'global'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(async (cliOptions: LogsOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
      );
      process.exit(1);
    }

    // 1. Build Argument List
    const commandArgs = ['functions:log', '--project', options.projectId];

    const argMappings: Record<string, string | boolean | undefined> = {
      '--only': cliOptions.only,
      '--lines': cliOptions.lines,
      '--since': cliOptions.since,
      '--open': cliOptions.open,
    };

    for (const [flag, value] of Object.entries(argMappings)) {
      if (value === true) {
        commandArgs.push(flag);
      } else if (value) {
        commandArgs.push(flag, String(value));
      }
    }

    // 2. Logging and Execution
    logger.info(`📋 Fetching logs for project: ${chalk.cyan.bold(options.projectId)}`);
    logger.debug(`> firebase ${commandArgs.join(' ')}`);

    try {
      await executeCommand('firebase', {
        args: commandArgs,
        stdio: 'inherit',
        packageManager: options.packageManager,
      });
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to fetch logs: ${(error as Error).message}`));
    }
  });
