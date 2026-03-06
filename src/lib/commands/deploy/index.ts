import { basename, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { rulesAction } from '$commands/rules/index.js';
import { logger } from '$logger';
import { loadChecksums } from '$utils/checksum.js';
import { runFunctions } from '$utils/run-functions.js';
import { getEnvironment } from './utils/environment.js';
import { findFunctions } from './utils/find_functions.js';
import { getCacheContext, updateRemoteCache } from './utils/functions_cache.js';
import { type DeployOptions, getOptions } from './utils/options.js';
import { processFunction } from './utils/process_function.js';
import { retryFailedFunctions } from './utils/retry_failed_functions.js';

export interface ExtendedDeployOptions extends DeployOptions {
  all?: boolean;
}

/**
 * Main deployment action that orchestrates the entire process.
 */
export const deployAction = async (cliOptions: ExtendedDeployOptions) => {
  const options = await getOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
    );
    exit(1);
  }

  // 1. Parallel Context Initialization
  logger.info(chalk.bold.green('🚀 Starting deployment...'));

  const [cacheContext, environment] = await Promise.all([
    getCacheContext(options.flavor),
    getEnvironment(options.flavor),
  ]);

  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  // 2. Rules Deployment (Optional)
  if (cliOptions.all) {
    logger.info(chalk.cyan('📦 Deploying all (rules and functions)...'));
    await rulesAction({ ...cliOptions, cacheContext });
  }

  // 3. Functions Discovery
  if (!options.functionsDirectory) {
    throw new Error('Functions directory is required for deployment.');
  }

  const functionsPath = join(cwd(), options.functionsDirectory);
  let functionFiles = await findFunctions(functionsPath);

  // Filter if '--only' is specified
  if (options.only) {
    const onlyFunctions = options.only.split(',').map((f) => f.trim());
    functionFiles = functionFiles.filter((file) => {
      const functionName = basename(file).replace(/\.(ts|tsx|js)$/, '');
      return onlyFunctions.includes(functionName);
    });
  }

  if (functionFiles.length === 0) {
    logger.warn(chalk.yellow('⚠️  No functions found to deploy.'));
    return;
  }

  logger.info(`🔍 Found ${chalk.bold.cyan(functionFiles.length)} function(s) to deploy.`);

  // 4. Execute Parallel Function Processing
  const rawResults = await runFunctions(
    functionFiles.map((path) => () => processFunction(path, options, environment, functionsPath)),
    options.concurrency
  );

  const results = rawResults.filter((r) => r);

  // 5. Retry Logic for Failed Functions
  let failedFunctions = results.filter((r) => r?.status === 'failed') as {
    functionName: string;
    status: string;
  }[];

  if (failedFunctions.length > 0) {
    failedFunctions = await retryFailedFunctions(
      failedFunctions,
      functionFiles,
      options,
      environment,
      functionsPath
    );
  }

  // 6. Final Status Check
  if (failedFunctions.length > 0) {
    logger.error(
      chalk.bold.red(`\n❌ Deployment failed for ${failedFunctions.length} function(s).`)
    );
    exit(1);
  }

  // 7. Synchronize Remote Cache
  if (remoteUtils.update) {
    const latestLocalCache = await loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor: options.flavor,
    });

    const newRemoteCacheData = { ...previousCache, ...latestLocalCache };
    const success = await updateRemoteCache(remoteUtils.update, options.flavor, newRemoteCacheData);
    if (success) {
      logger.info(chalk.dim('🌐 Remote cache updated.'));
    }
  }
  logger.info(chalk.bold.green('\n✨ Deployment process complete!'));
};

export const deployCommand = new Command('deploy')
  .description('Builds and deploys all Firebase functions.')
  .option('--flavor <flavor>', 'The flavor to use for deployment.', 'development')
  .option('--dry-run', 'Show the deployment commands without executing them.')
  .option('--force', 'Force deploy all functions, even if no files changed.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--only <only>', 'Only deploy the given function names separated by comma.')
  .option('--region <region>', 'The default region to deploy the functions to.')
  .option('--concurrency <concurrency>', 'The number of functions to deploy in parallel.', '5')
  .option('--retryAmount <retryAmount>', 'The amount of times to retry a failed deployment.', '0')
  .option('--minify', 'Will minify the functions.', true)
  .option('--sourcemap', 'Whether to generate sourcemaps.', true)
  .option(
    '--functionsDirectory <functionsDirectory>',
    'The directory where the functions are located.'
  )
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--node-version <nodeVersion>', 'The Node.js version to use for the functions.')
  .option('--debug', 'Enable debug mode (keeps temporary files).')
  .option('--all', 'Deploy both functions and rules.')
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).',
    'global'
  )
  .action(deployAction);
