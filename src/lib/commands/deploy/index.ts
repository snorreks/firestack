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
import {
  executeFunctionDeployment,
  type PrepareResult,
  type ProcessResult,
  prepareFunction,
} from './utils/process_function.js';
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

  // 4. Phase 1: Planning (Build & Check Changes)
  const prepareResults = await runFunctions<PrepareResult>(
    functionFiles.map(
      (path) => () =>
        prepareFunction({
          funcPath: path,
          options,
          environment,
          controllersPath: functionsPath,
        })
    ),
    options.concurrency
  );

  // 5. Aggregate and Log Plan
  const toDeploy = prepareResults.filter((r) => r.status === 'to-deploy');
  const skipped = prepareResults.filter((r) => r.status === 'skipped').map((r) => r.functionName);
  const failedPrep = prepareResults.filter((r) => r.status === 'failed').map((r) => r.functionName);
  const dryRun = prepareResults.filter((r) => r.status === 'dry-run').map((r) => r.functionName);

  if (skipped.length > 0) {
    logger.info(chalk.yellow(`⏭️  Skipped (${skipped.length}): ${chalk.dim(skipped.join(', '))}`));
  }
  if (failedPrep.length > 0) {
    logger.error(
      chalk.red(`❌ Failed to prepare (${failedPrep.length}): ${failedPrep.join(', ')}`)
    );
  }
  if (dryRun.length > 0) {
    logger.info(chalk.blue(`📝 Dry run (${dryRun.length}): ${chalk.bold(dryRun.join(', '))}`));
  }

  if (toDeploy.length === 0) {
    logger.info(chalk.green('✅ Nothing to deploy.'));
    return;
  }

  logger.info(
    chalk.cyan(
      `📦 Deploying (${toDeploy.length}): ${chalk.bold(toDeploy.map((r) => r.functionName).join(', '))}`
    )
  );

  // 6. Phase 2: Execution (Install & Deploy)
  const totalToDeploy = toDeploy.length;
  let deployedCount = 0;

  const deployResults = await runFunctions<ProcessResult>(
    toDeploy.map((prep) => async () => {
      const result = await executeFunctionDeployment({ prepareResult: prep, options });
      deployedCount++;
      if (result.status === 'failed') {
        logger.error(`❌ Failed: ${chalk.bold(result.functionName)}`);
      } else if (options.verbose) {
        logger.debug(`[${deployedCount}/${totalToDeploy}] Deployed ${result.functionName}`);
      }
      return result;
    }),
    options.concurrency
  );

  const finalResults = deployResults.filter((r): r is ProcessResult => !!r);
  const successfullyDeployed = finalResults
    .filter((r) => r.status === 'deployed')
    .map((r) => r.functionName);

  if (successfullyDeployed.length > 0) {
    logger.info(
      chalk.green(
        `✅ Successfully deployed (${successfullyDeployed.length}): ${chalk.bold(successfullyDeployed.join(', '))}`
      )
    );
  }

  // 7. Retry Logic for Failed Functions
  let failedFunctions = finalResults.filter((r) => r.status === 'failed');

  if (failedFunctions.length > 0) {
    failedFunctions = await retryFailedFunctions({
      failedFunctions,
      functionFiles,
      options,
      environment,
      functionsPath,
    });
  }

  // 8. Final Status Check
  if (failedFunctions.length > 0) {
    logger.error(
      chalk.bold.red(`\n❌ Deployment failed for ${failedFunctions.length} function(s).`)
    );
    exit(1);
  }

  // 9. Synchronize Remote Cache
  if (remoteUtils.update) {
    const latestLocalCache = await loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor: options.flavor,
    });

    const newRemoteCacheData = { ...previousCache, ...latestLocalCache };
    const success = await updateRemoteCache({
      updateFn: remoteUtils.update,
      flavor: options.flavor,
      newCache: newRemoteCacheData,
    });
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
