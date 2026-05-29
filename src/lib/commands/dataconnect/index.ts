import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { CacheContext, DataconnectCliOptions } from '$types';
import { executeCommand } from '$utils/command.ts';
import { getCacheContext, updateRemoteCache } from '$utils/functions_cache.ts';
import { getDataconnectOptions } from '$utils/options.ts';
import { findDataconnectFiles, generateDataconnectChecksum } from './utils/dataconnect_files.ts';

type DataconnectOptions = DataconnectCliOptions;

/**
 * Main action for the dataconnect command.
 */
export const dataconnectAction = async (
  cliOptions: DataconnectOptions & { cacheContext?: CacheContext }
) => {
  const options = await getDataconnectOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack config.'
      )
    );
    exit(1);
  }

  const projectRoot = cwd();
  const dataconnectDir = join(projectRoot, options.dataconnectDirectory);

  // 1. Find dataconnect source files
  const files = await findDataconnectFiles({
    dataconnectDirectory: dataconnectDir,
  });

  if (files.length === 0) {
    logger.warn(chalk.yellow('No dataconnect files found to deploy.'));
    return;
  }

  logger.info(`🔍 Found ${chalk.bold.cyan(files.length)} dataconnect file(s).`);

  // 2. Fetch cache context
  const cacheContext =
    cliOptions.cacheContext ??
    (await getCacheContext({
      mode: options.mode,
      cloudCacheFileName: options.cloudCacheFileName,
    }));
  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  // 3. Generate checksum and check for changes
  const newChecksum = await generateDataconnectChecksum(files);
  const cacheKey = 'dataconnect';

  if (!options.force) {
    const cachedChecksum = previousCache[cacheKey];
    if (cachedChecksum === newChecksum) {
      logger.info(chalk.green('✅ No changes detected in dataconnect. Skipping deployment.'));
      return;
    }
  }

  logger.info(chalk.cyan('📡 Deploying Data Connect...'));

  // 4. Prepare a temporary deployment directory
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const tempDir = join(projectRoot, 'dist', `dataconnect-deploy-${uniqueId}`);
  await mkdir(tempDir, { recursive: true });

  // Copy dataconnect source into temp directory so Firebase CLI can find it
  const { cp } = await import('node:fs/promises');
  const dataconnectTempDir = join(tempDir, 'dataconnect');
  await cp(dataconnectDir, dataconnectTempDir, { recursive: true });

  // Build firebase.json with dataconnect source pointing to the copied directory
  const firebaseConfig = { dataconnect: { source: 'dataconnect' } };
  await writeFile(join(tempDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));

  // 6. Handle dry-run
  if (cliOptions.dryRun) {
    // Still update caches so subsequent runs know files are unchanged
    await updateDataconnectCaches({
      projectRoot,
      mode: options.mode,
      cacheKey,
      newChecksum,
      previousCache,
      remoteUtils,
    });

    logger.info(chalk.bold.green('✨ Dataconnect dry-run complete.'));
    logger.info(chalk.dim(`📂 Configuration at: ${tempDir}`));
    return;
  }

  // 7. Execute deployment
  const commandArgs = ['deploy', '--only', 'dataconnect', '--project', options.projectId];

  if (options.force) {
    commandArgs.push('--force');
  }

  logger.debug(`🔥 Running: ${chalk.dim(`firebase ${commandArgs.join(' ')}`)}`);
  logger.debug(`📂 Working directory: ${chalk.dim(tempDir)}`);

  const result = await executeCommand('firebase', {
    args: commandArgs,
    cwd: tempDir,
    packageManager: options.packageManager,
  });

  if (!result.success) {
    logger.error(chalk.red('❌ Failed to deploy Data Connect.'));
    exit(1);
  }

  logger.info(chalk.bold.green('✅ Data Connect deployed successfully.'));

  // 7. Update caches
  await updateDataconnectCaches({
    projectRoot,
    mode: options.mode,
    cacheKey,
    newChecksum,
    previousCache,
    remoteUtils,
  });
};

/**
 * Updates local and remote caches with the new dataconnect checksum.
 */
const updateDataconnectCaches = async (options: {
  projectRoot: string;
  mode: string;
  cacheKey: string;
  newChecksum: string;
  previousCache: Record<string, string>;
  remoteUtils: CacheContext['remoteUtils'];
}): Promise<void> => {
  const { projectRoot, mode, cacheKey, newChecksum, previousCache, remoteUtils } = options;

  const checksumsFolder = join(projectRoot, 'dist', '.checksums', mode);
  await mkdir(checksumsFolder, { recursive: true });

  const { loadChecksums } = await import('$utils/checksum.ts');
  const currentLocal = await loadChecksums({
    outputDirectory: join(projectRoot, 'dist'),
    mode,
  });
  const updatedLocal = { ...currentLocal, [cacheKey]: newChecksum };
  await writeFile(join(checksumsFolder, 'checksums.json'), JSON.stringify(updatedLocal, null, 2));

  if (remoteUtils.updateCacheCallable) {
    const updatedRemote = { ...previousCache, [cacheKey]: newChecksum };
    const remoteSuccess = await updateRemoteCache({
      updateCacheCallable: remoteUtils.updateCacheCallable,
      mode,
      newCache: updatedRemote,
    });
    if (remoteSuccess) {
      logger.info(chalk.dim('🌐 Remote cache updated.'));
    }
  }
};

/**
 * The dataconnect command definition.
 */
export const dataconnectCommand = new Command('dataconnect')
  .description('Deploys Firebase Data Connect schema and connectors.')
  .option('--mode <mode>', 'The mode to use for deployment.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--force', 'Force deploy dataconnect, even if no files changed.')
  .option('--dry-run', 'Build configuration for dataconnect but do not deploy.')
  .option(
    '--cloudCacheFileName <cloudCacheFileName>',
    'The name of the file used for the cloud cache.'
  )
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .option(
    '--dataconnectDirectory <dataconnectDirectory>',
    'The directory containing the Data Connect configuration.'
  )
  .action(dataconnectAction);
