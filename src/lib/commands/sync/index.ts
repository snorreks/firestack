import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { SyncCliOptions, SyncCommandOptions } from '$types';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';
import { getSyncOptions } from '$utils/options.ts';

/**
 * Main action for the sync command.
 * @param cliOptions - The options provided via CLI
 */
export const syncAction = async (cliOptions: SyncCliOptions) => {
  const syncOptions = await getSyncOptions(cliOptions);

  if (!syncOptions.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack config.'
      )
    );
    exit(1);
  }

  const rulesDir = join(cwd(), syncOptions.rulesDirectory || 'src/rules');
  if (!(await exists(rulesDir))) {
    await mkdir(rulesDir, { recursive: true });
  }

  const targets = syncOptions.only
    ? syncOptions.only.split(',').map((t) => t.trim())
    : ['firestore', 'storage', 'indexes'];

  const syncPromises: Promise<void>[] = [];

  if (targets.includes('firestore')) {
    syncPromises.push(syncFirestoreRules({ syncOptions, rulesDir }));
  }

  if (targets.includes('storage')) {
    syncPromises.push(syncStorageRules({ syncOptions, rulesDir }));
  }

  if (targets.includes('indexes')) {
    syncPromises.push(syncFirestoreIndexes({ syncOptions, rulesDir }));
  }

  await Promise.all(syncPromises);

  logger.info(chalk.bold.green('✅ Sync completed.'));
};

type SyncTargetOptions = {
  syncOptions: SyncCommandOptions;
  rulesDir: string;
};

/**
 * Syncs Firestore rules from Firebase.
 * @param options - Sync target options
 */
const syncFirestoreRules = async (options: SyncTargetOptions) => {
  const { syncOptions, rulesDir } = options;
  logger.info(`Fetching ${chalk.cyan('Firestore rules')}...`);

  // Try firebase firestore:rules:get (though it might not exist in all versions)
  let result = await executeCommand('firebase', {
    args: ['firestore:rules:get', '--project', syncOptions.projectId],
    packageManager: syncOptions.packageManager,
  });

  if (!result.success) {
    logger.debug(`Firebase rules:get failed, trying gcloud fallback...`);
    // Try gcloud fallback
    result = await executeCommand('gcloud', {
      args: [
        'alpha',
        'firestore',
        'rulesets',
        'list',
        '--project',
        syncOptions.projectId,
        '--limit',
        '1',
        '--format',
        'value(name)',
      ],
    });

    if (result.success && result.stdout.trim()) {
      const rulesetName = result.stdout.trim();
      result = await executeCommand('gcloud', {
        args: [
          'alpha',
          'firestore',
          'rulesets',
          'describe',
          rulesetName,
          '--project',
          syncOptions.projectId,
          '--format',
          'value(source.files[0].content)',
        ],
      });
    }
  }

  if (!result.success || !result.stdout.trim()) {
    logger.warn(
      chalk.yellow(
        `⚠️  Could not fetch Firestore rules. This command may not be supported by your CLI versions or project permissions.`
      )
    );
    logger.debug(`Error: ${result.stderr}`);
    return;
  }

  const fileName = syncOptions.firestoreRules || 'firestore.rules';
  const filePath = join(rulesDir, fileName);

  await writeFile(filePath, result.stdout);
  logger.info(`✅ Updated ${chalk.bold(filePath)}`);
};

/**
 * Syncs Storage rules from Firebase.
 * @param options - Sync target options
 */
const syncStorageRules = async (options: SyncTargetOptions) => {
  const { syncOptions, rulesDir } = options;
  logger.info(`Fetching ${chalk.cyan('Storage rules')}...`);

  const result = await executeCommand('firebase', {
    args: ['storage:rules:get', '--project', syncOptions.projectId],
    packageManager: syncOptions.packageManager,
  });

  if (!result.success || !result.stdout.trim()) {
    logger.warn(
      chalk.yellow(
        `⚠️  Could not fetch Storage rules. This command may not be supported by your CLI versions or project permissions.`
      )
    );
    logger.debug(`Error: ${result.stderr}`);
    return;
  }

  const fileName = syncOptions.storageRules || 'storage.rules';
  const filePath = join(rulesDir, fileName);

  await writeFile(filePath, result.stdout);
  logger.info(`✅ Updated ${chalk.bold(filePath)}`);
};

/**
 * Syncs Firestore indexes from Firebase.
 * @param options - Sync target options
 */
const syncFirestoreIndexes = async (options: SyncTargetOptions) => {
  const { syncOptions, rulesDir } = options;
  logger.info(`Fetching ${chalk.cyan('Firestore indexes')}...`);

  const result = await executeCommand('firebase', {
    args: ['firestore:indexes', '--project', syncOptions.projectId, '--json'],
    packageManager: syncOptions.packageManager,
  });

  if (!result.success) {
    logger.error(`❌ Failed to fetch Firestore indexes: ${result.stderr}`);
    return;
  }

  try {
    const json = JSON.parse(result.stdout);
    const indexes = json.result || json;
    const filePath = join(rulesDir, 'firestore.indexes.json');

    await writeFile(filePath, JSON.stringify(indexes, null, 2));
    logger.info(`✅ Updated ${chalk.bold(filePath)}`);
  } catch (e) {
    logger.error(`❌ Failed to parse Firestore indexes JSON: ${(e as Error).message}`);
    logger.debug(`Raw output: ${result.stdout}`);
  }
};

/**
 * The sync command definition.
 */
export const syncCommand = new Command('sync')
  .description('Syncs Firestore, Storage rules, and indexes from Firebase.')
  .option('--mode <mode>', 'The mode to use for syncing.')
  .option('--projectId <projectId>', 'The Firebase project ID to sync from.')
  .option(
    '--only <only>',
    'Only sync the specified components (e.g., "firestore,storage,indexes").'
  )
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .action(syncAction);
