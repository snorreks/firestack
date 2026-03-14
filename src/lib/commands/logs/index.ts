import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { PackageManager } from '$types';
import { executeCommand } from '$utils/command.ts';
import { getLogsOptions } from '$utils/options.ts';

type LogsOptions = {
  flavor?: string;
  projectId?: string;
  only?: string;
  lines?: string;
  since?: string;
  open?: boolean;
  verbose?: boolean;
  packageManager?: PackageManager;
  external?: string[];
};

export const logsCommand = new Command('logs')
  .description('View logs from Firebase Cloud Functions.')
  .option('--flavor <flavor>', 'The flavor to use for logs.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID.')
  .option('--only <only>', 'Only show logs for specific function(s).')
  .option('-n, --lines <lines>', 'Number of log lines to fetch.')
  .option('--since <since>', 'Only show logs after this time (e.g., "1h", "30m").')
  .option('--open', 'Open logs in web browser.')
  .option('--minify', 'Will minify the functions.')
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(async (cliOptions: LogsOptions) => {
    const options = await getLogsOptions(cliOptions);

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
