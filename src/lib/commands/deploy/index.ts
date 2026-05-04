import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { rulesAction } from '$commands/rules/index.ts';
import { logger } from '$logger';
import type { DeployCommandOptions } from '$types';
import { loadChecksums } from '$utils/checksum.ts';
import { getEnvironment } from '$utils/environment.ts';
import { findFunctions } from '$utils/find_functions.ts';
import { getCacheContext, updateRemoteCache } from '$utils/functions_cache.ts';
import { getDeployOptions } from '$utils/options.ts';
import { runFunctions } from '$utils/run-functions.ts';
import {
  type FunctionMetadata,
  filterFunctionsByOnly,
  parseFunctionMetadata,
} from './utils/parse_function_metadata.ts';
import {
  executeFunctionDeployment,
  type PrepareResult,
  type ProcessResult,
  prepareFunction,
} from './utils/process_function.ts';
import { retryFailedFunctions } from './utils/retry_failed_functions.ts';

export type ExtendedDeployOptions = DeployCommandOptions & {
  all?: boolean;
};

/**
 * Main deployment action that orchestrates the entire process.
 */
export const deployAction = async (cliOptions: ExtendedDeployOptions) => {
  const deployOptions = await getDeployOptions(cliOptions);

  if (!deployOptions.projectId) {
    logger.error(
      chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
    );
    exit(1);
  }

  // 1. Parallel Context Initialization
  logger.info(chalk.bold.green('🚀 Starting deployment...'));

  const [cacheContext, environment] = await Promise.all([
    getCacheContext(deployOptions.flavor || 'default'),
    getEnvironment(deployOptions.flavor || 'default'),
  ]);

  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  // 2. Rules Deployment (Optional)
  if (cliOptions.all) {
    logger.info(chalk.cyan('📦 Deploying all (rules and functions)...'));
    await rulesAction({ ...cliOptions, cacheContext });
  }

  // 3. Functions Discovery & Metadata Parsing
  if (!deployOptions.functionsDirectory) {
    throw new Error('Functions directory is required for deployment.');
  }

  const functionsDirectoryPath = join(cwd(), deployOptions.functionsDirectory);
  const functionFiles = await findFunctions(functionsDirectoryPath);

  // Parse metadata for all functions in parallel
  const functionMetadataList = await Promise.all(
    functionFiles.map((functionPath) =>
      parseFunctionMetadata({
        functionPath,
        functionsDirectoryPath,
        defaultRegion: deployOptions.region,
        defaultNodeVersion: deployOptions.nodeVersion,
      })
    )
  );

  // Filter out undefineds (non-deployable files)
  let functionMetadata = functionMetadataList.filter((m): m is FunctionMetadata => m !== undefined);

  // Filter if '--only' is specified
  if (deployOptions.only) {
    const onlyFunctions = deployOptions.only.split(',').map((f) => f.trim());
    functionMetadata = filterFunctionsByOnly({
      functionMetadata,
      only: onlyFunctions,
    });
  }

  if (functionMetadata.length === 0) {
    logger.warn(chalk.yellow('⚠️  No functions found to deploy.'));
    return;
  }

  logger.info(`🔍 Found ${chalk.bold.cyan(functionMetadata.length)} function(s) to deploy.`);

  // 4. Phase 1: Planning (Build & Check Changes)
  const prepareResults = await runFunctions<PrepareResult>(
    functionMetadata.map(
      (metadata) => () =>
        prepareFunction({
          functionPath: metadata.functionPath,
          deployOptions,
          environment,
          functionsDirectoryPath,
          metadata,
          cachedChecksums: previousCache,
        })
    ),
    deployOptions.concurrency
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
      const result = await executeFunctionDeployment({ prepareResult: prep, deployOptions });
      deployedCount++;
      if (result.status === 'failed') {
        logger.error(`❌ Failed: ${chalk.bold(result.functionName)}`);
      } else if (logger.verbose) {
        logger.debug(`[${deployedCount}/${totalToDeploy}] Deployed ${result.functionName}`);
      }
      return result;
    }),
    deployOptions.concurrency
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

  // 7. Cleanup Warning Summary
  const cleanupWarnings = finalResults.filter((r) => r.cleanupWarning);

  // 8. Retry Logic for Failed Functions
  let failedFunctions = finalResults.filter((r) => r.status === 'failed');

  if (failedFunctions.length > 0) {
    failedFunctions = await retryFailedFunctions({
      failedFunctions,
      functionPaths: functionFiles,
      deployOptions,
      environment,
      functionsDirectoryPath,
    });
  }

  // 9. Final Status Check
  if (failedFunctions.length > 0) {
    const failedNames = failedFunctions.map((f) => f.functionName).join(', ');
    logger.error(
      chalk.bold.red(
        `\n❌ Deployment failed for ${failedFunctions.length} function(s): ${chalk.red(failedNames)}`
      )
    );
    logger.info(
      chalk.dim(`💡 To retry failed functions, run: ${chalk.cyan(`deploy --only ${failedNames}`)}`)
    );
    exit(1);
  }

  if (cleanupWarnings.length > 0) {
    const warningNames = cleanupWarnings.map((w) => w.functionName).join(', ');
    logger.warn(
      chalk.yellow(
        `\n⚠️  Cleanup policy could not be set up for ${cleanupWarnings.length} function(s): ${chalk.bold(warningNames)}`
      )
    );
    logger.info(
      chalk.dim(
        `💡 To fix this, run: ${chalk.cyan('firebase functions:artifacts:setpolicy')} or pass ${chalk.cyan('--force')} to automatically set up a cleanup policy.`
      )
    );
  }

  // 10. Synchronize Remote Cache
  if (remoteUtils.updateCacheCallable) {
    const latestLocalCache = await loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor: deployOptions.flavor || 'default',
    });

    const newRemoteCacheData = { ...previousCache, ...latestLocalCache };
    const success = await updateRemoteCache({
      updateCacheCallable: remoteUtils.updateCacheCallable,
      flavor: deployOptions.flavor || 'default',
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
  .option('--flavor <flavor>', 'The flavor to use for deployment.')
  .option('--dry-run', 'Show the deployment commands without executing them.')
  .option('--force', 'Force deploy all functions, even if no files changed.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--only <only>', 'Only deploy the given function names separated by comma.')
  .option('--region <region>', 'The default region to deploy the functions to.')
  .option('--concurrency <concurrency>', 'The number of functions to deploy in parallel.')
  .option('--retryAmount <retryAmount>', 'The amount of times to retry a failed deployment.')
  .option('--minify', 'Will minify the functions.')
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
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
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .option('--tsconfig <tsconfig>', 'Path to the tsconfig file to use for the build.')
  .action(deployAction);
