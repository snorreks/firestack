import { Command } from 'commander';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';

interface LogsOptions extends DeployOptions {
  only?: string;
  lines?: string;
  since?: string;
  open?: boolean;
}

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
    'npm'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(async (cliOptions: LogsOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      process.exit(1);
    }

    const commandArgs = ['functions:log', '--project', options.projectId!];

    if (cliOptions.only) {
      commandArgs.push('--only', cliOptions.only);
    }

    if (cliOptions.lines) {
      commandArgs.push('--lines', cliOptions.lines);
    }

    if (cliOptions.since) {
      commandArgs.push('--since', cliOptions.since);
    }

    if (cliOptions.open) {
      commandArgs.push('--open');
    }

    logger.info(`Fetching logs for project: ${options.projectId}`);
    logger.debug(`> firebase ${commandArgs.join(' ')}`);

    await executeCommand('firebase', {
      args: commandArgs,
      stdio: 'inherit',
      packageManager: options.packageManager,
    });
  });
