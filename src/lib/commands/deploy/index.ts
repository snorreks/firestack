import { basename, join } from 'node:path';
import { cwd, exit } from 'node:process';
import { Command } from 'commander';
import { rulesAction } from '$commands/rules/index.js';
import { logger } from '$logger';
import { loadChecksums } from '$utils/checksum.js';
import { runFunctions } from '$utils/run-functions.js';
import { getEnvironment } from './utils/environment.js';
import { findFunctions } from './utils/find_functions.js';
import {
  fetchRemoteCache,
  getRemoteCacheUtils,
  updateRemoteCache,
} from './utils/functions_cache.js';
import { type DeployOptions, getOptions } from './utils/options.js';
import { processFunction } from './utils/process_function.js';
import { retryFailedFunctions } from './utils/retry_failed_functions.js';

export interface ExtendedDeployOptions extends DeployOptions {
  all?: boolean;
}

export const deployAction = async (cliOptions: ExtendedDeployOptions) => {
  if (cliOptions.all) {
    logger.info('Deploying all (rules and functions)...');
    await rulesAction(cliOptions);
  }

  const options = await getOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      'Project ID not found. Please provide it using --projectId option or in firestack.json.'
    );
    exit(1);
  }

  // 1. Fetch online and locally in parallel
  const [{ get: getRemote, update: updateRemote }, localCache] = await Promise.all([
    getRemoteCacheUtils(),
    loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor: options.flavor,
    }),
  ]);

  let previousCache: Record<string, string> = { ...localCache };

  if (getRemote) {
    const remoteCache = await fetchRemoteCache(getRemote, options.flavor);
    if (remoteCache) {
      logger.debug('Using remote cache, merging with local');
      previousCache = { ...previousCache, ...remoteCache };
    }
  }

  if (!options.functionsDirectory) {
    throw new Error('Functions directory is required for deployment.');
  }

  const functionsPath = join(cwd(), options.functionsDirectory);
  let functionFiles = await findFunctions(functionsPath);

  if (options.only) {
    const onlyFunctions = options.only.split(',').map((f) => f.trim());
    functionFiles = functionFiles.filter((file) => {
      const functionName = basename(file).replace(/\.(ts|tsx|js)$/, '');
      return onlyFunctions.includes(functionName);
    });
  }

  if (functionFiles.length === 0) {
    logger.warn('No functions found to deploy.');
    return;
  }

  logger.info(`Found ${functionFiles.length} functions to deploy.`);

  const environment = await getEnvironment(options.flavor);

  const results = (
    await runFunctions(
      functionFiles.map((path) => () => processFunction(path, options, environment, functionsPath)),
      options.concurrency
    )
  ).filter((r) => r);

  let failedFunctions = results.filter((r) => r?.status === 'failed') as {
    functionName: string;
    status: string;
  }[];

  failedFunctions = await retryFailedFunctions(
    failedFunctions,
    functionFiles,
    options,
    environment,
    functionsPath
  );

  if (failedFunctions.length > 0) {
    logger.error(`\nDeployment failed for ${failedFunctions.length} functions.`);
    exit(1);
  }

  // 2. Update online and locally in parallel when done
  // Local cache is already updated inside processFunction -> builds -> cacheChecksumLocal
  // We just need to sync the remote cache if it exists.

  if (updateRemote) {
    // Re-load local cache to get all latest checksums
    const latestLocalCache = await loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor: options.flavor,
    });

    // Merge remote with latest local to ensure we have everything
    const newRemoteCacheData = { ...previousCache, ...latestLocalCache };

    await updateRemoteCache(updateRemote, options.flavor, newRemoteCacheData);
    logger.info('Remote cache updated.');
  }

  logger.info('\nDeployment process complete!');
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
