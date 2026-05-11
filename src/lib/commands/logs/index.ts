import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { LogsCliOptions, LogsCommandOptions } from '$types';
import { executeCommand } from '$utils/command.ts';
import { getLogsOptions } from '$utils/options.ts';

/**
 * Main action for the logs command.
 * @param cliOptions - The options provided via CLI
 */
export const logsAction = async (cliOptions: LogsCliOptions) => {
  const options = await getLogsOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack config.')
    );
    process.exit(1);
  }

  const useGcloud = options.tail || (options.type && options.type !== 'functions') || options.limit;

  if (useGcloud) {
    await executeGcloudLogs(options);
  } else {
    await executeFirebaseLogs(options);
  }
};

/**
 * Executes logs using firebase functions:log.
 * @param options - Logs command options
 */
const executeFirebaseLogs = async (options: LogsCommandOptions) => {
  const { projectId } = options;
  if (!projectId) {
    logger.error(chalk.red('❌ Project ID is required.'));
    return;
  }
  const commandArgs: string[] = ['functions:log', '--project', projectId];

  if (options.only) {
    commandArgs.push('--only', options.only);
  }
  if (options.lines) {
    commandArgs.push('--lines', options.lines);
  }
  if (options.since) {
    commandArgs.push('--since', options.since);
  }
  if (options.open) {
    commandArgs.push('--open');
  }

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
};

/**
 * Executes logs using gcloud logging.
 * @param options - Logs command options
 */
const executeGcloudLogs = async (options: LogsCommandOptions) => {
  const { type = 'functions', projectId, tail, limit, lines, only } = options;
  const isTail = !!tail;
  const command = isTail ? 'tail' : 'read';
  const finalLimit = limit || lines || (isTail ? undefined : '100');

  let filter = '';
  switch (type) {
    case 'firestore':
      filter = 'resource.type="cloud_firestore_database"';
      break;
    case 'auth':
      filter =
        'logName:"logs/cloudaudit.googleapis.com%2Factivity" AND protoPayload.serviceName="identitytoolkit.googleapis.com"';
      break;
    case 'storage':
      filter = 'resource.type="gcs_bucket"';
      break;
    case 'all':
      filter = '';
      break;
    default:
      filter = '(resource.type="cloud_function" OR resource.type="cloud_run_revision")';
      if (only) {
        const functionNames = only.split(',').map((s) => s.trim());
        const functionFilter = functionNames
          .map(
            (name) =>
              `(resource.labels.function_name="${name}" OR resource.labels.service_name="${name}")`
          )
          .join(' OR ');
        filter += ` AND (${functionFilter})`;
      }
      break;
  }

  if (!projectId) {
    logger.error(chalk.red('❌ Project ID is required for gcloud logs.'));
    process.exit(1);
  }

  const commandArgs = ['logging', command, filter, '--project', projectId];

  if (!isTail && finalLimit) {
    commandArgs.push('--limit', finalLimit);
  }

  if (isTail) {
    logger.info(
      `👀 Tailing ${chalk.bold.cyan(type)} logs for project: ${chalk.bold.green(projectId)}`
    );
  } else {
    logger.info(
      `📋 Reading last ${chalk.bold(finalLimit)} ${chalk.bold.cyan(type)} logs for project: ${chalk.bold.green(projectId)}`
    );
  }

  logger.debug(`> gcloud ${commandArgs.join(' ')}`);

  try {
    await executeCommand('gcloud', {
      args: commandArgs,
      stdio: 'inherit',
    });
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to fetch gcloud logs: ${(error as Error).message}`));
    logger.info(chalk.yellow('Make sure you have gcloud installed and authenticated.'));
  }
};

export const logsCommand = new Command('logs')
  .description('View logs from Firebase or Google Cloud.')
  .option('--mode <mode>', 'The mode to use for logs.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID.')
  .option('--only <only>', 'Only show logs for specific function(s).')
  .option('-n, --lines <lines>', 'Number of log lines to fetch.')
  .option('--limit <limit>', 'Number of log lines to fetch (alias for --lines).')
  .option('--since <since>', 'Only show logs after this time (e.g., "1h", "30m").')
  .option('--open', 'Open logs in web browser.')
  .option('--tail', 'Tail logs in real-time.')
  .option(
    '--type <type>',
    'The type of logs to fetch (functions, firestore, auth, storage, all).',
    'functions'
  )
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .action(logsAction);
