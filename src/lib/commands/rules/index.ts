import { existsSync as _existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { createHash } from 'node:crypto';
import { Command } from 'commander';
import { type DeployOptions, getOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';
import {
  type CacheContext,
  getCacheContext,
  updateRemoteCache,
} from '$commands/deploy/utils/functions_cache.js';
import { findRuleFiles } from './utils/rule_files.js';
import { loadChecksums } from '$utils/checksum.js';
import { exists } from '$utils/common.js';

/**
 * Options for the rules command.
 */
interface RulesOptions extends DeployOptions {
  only?: string;
  force?: boolean;
  cacheContext?: CacheContext;
}

export const rulesAction = async (cliOptions: RulesOptions) => {
  const options = await getOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      'Project ID not found. Please provide it using --projectId option or in firestack.json.'
    );
    exit(1);
  }

  // 1. Fetch cache context if not provided
  const cacheContext = cliOptions.cacheContext ?? await getCacheContext(options.flavor);
  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  const rulesDir = join(cwd(), options.rulesDirectory || 'src/rules');
  const ruleFiles = await findRuleFiles(options.rulesDirectory || 'src/rules');

  if (ruleFiles.length === 0) {
    logger.warn('No rule or index files found to deploy.');
    return;
  }

  // Filter rule files based on only option
  let filteredRuleFiles = ruleFiles;
  if (options.only) {
    const onlyTargets = options.only.split(',').map((t) => t.trim());
    filteredRuleFiles = ruleFiles.filter((r) => onlyTargets.includes(r.type));
  }

  const algorithm = 'md5';
  const checksumsFolder = join(cwd(), 'dist', '.checksums', options.flavor);

  const rulesToDeploy: typeof ruleFiles = [];
  const newChecksums: Record<string, string> = {};

  for (const rule of filteredRuleFiles) {
    const sourcePath = join(rulesDir, rule.name);
    if (!(await exists(sourcePath))) continue;

    const content = await readFile(sourcePath, 'utf-8');
    const checksum = createHash(algorithm).update(content).digest('hex');
    const cacheKey = `rules:${rule.type}`;
    newChecksums[cacheKey] = checksum;

    let hasChanged = true;

    if (!options.force) {
      const cachedChecksum = previousCache[cacheKey];
      if (checksum === cachedChecksum) {
        hasChanged = false;
      }
    }

    if (hasChanged) {
      rulesToDeploy.push(rule);
    } else {
      logger.info(`${rule.type} rules have not changed, skipping deployment.`);
    }
  }

  if (rulesToDeploy.length === 0) {
    logger.info('No changes detected in rules or indexes. Skipping deployment.');
    return;
  }

  logger.info(`Found ${rulesToDeploy.length} rule/index file(s) to deploy.`);

  // Create a temporary directory for deployment
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const tempDir = join(cwd(), 'dist', `rules-deploy-${uniqueId}`);
  await mkdir(join(tempDir), { recursive: true });

  // Create firebase.json
  const firebaseConfig: Record<string, unknown> = {};
  for (const rule of rulesToDeploy) {
    if (rule.type === 'firestore') {
      firebaseConfig.firestore = {
        ...(firebaseConfig.firestore as Record<string, unknown>),
        rules: rule.name,
      };
    } else if (rule.type === 'storage') {
      firebaseConfig.storage = { rules: rule.name };
    } else if (rule.type === 'firestoreIndexes') {
      firebaseConfig.firestore = {
        ...(firebaseConfig.firestore as Record<string, unknown>),
        indexes: rule.name,
      };
    }
  }

  // If we have firestore rules, also add indexes reference
  const hasFirestore = rulesToDeploy.some(
    (r) => r.type === 'firestore' || r.type === 'firestoreIndexes'
  );
  const hasStorage = rulesToDeploy.some((r) => r.type === 'storage');

  if (!hasFirestore && !hasStorage) {
    logger.warn('No firestore or storage rules found to deploy after filtering.');
    return;
  }

  await writeFile(join(tempDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));

  // Copy rule files to temp dir
  for (const rule of rulesToDeploy) {
    const sourcePath = join(rulesDir, rule.name);
    const destPath = join(tempDir, rule.name);
    if (await exists(sourcePath)) {
      await copyFile(sourcePath, destPath);
      logger.debug(`Copied ${rule.name} to ${tempDir}`);
    }
  }

  // Determine what to deploy
  const deployTargets: string[] = [];
  if (hasFirestore) deployTargets.push('firestore');
  if (hasStorage) deployTargets.push('storage');

  const commandArgs = [
    'deploy',
    '--only',
    deployTargets.join(','),
    '--project',
    options.projectId,
  ];

  logger.info(`Deploying: ${deployTargets.join(', ')}`);
  logger.debug(`> firebase ${commandArgs.join(' ')}`);

  const result = await executeCommand('firebase', {
    args: commandArgs,
    cwd: tempDir,
    packageManager: options.packageManager,
  });

  if (result.success) {
    logger.info('Rules and indexes deployed successfully.');

    // 2. Update online and locally in parallel when done
    const updatePromises: Promise<void>[] = [];

    // Update local cache
    const updateLocalCache = async () => {
      if (!(await exists(checksumsFolder))) {
        await mkdir(checksumsFolder, { recursive: true });
      }
      const currentLocalChecksums = await loadChecksums({
        outputDirectory: join(cwd(), 'dist'),
        flavor: options.flavor,
      });
      const updatedLocalChecksums = { ...currentLocalChecksums, ...newChecksums };
      await writeFile(join(checksumsFolder, 'checksums.json'), JSON.stringify(updatedLocalChecksums, null, 2));
    };
    updatePromises.push(updateLocalCache());

    // Update remote cache
    if (remoteUtils.update) {
      const updatedRemoteCache = { ...previousCache, ...newChecksums };
      updatePromises.push(updateRemoteCache(remoteUtils.update, options.flavor, updatedRemoteCache));
    }

    await Promise.all(updatePromises);
    logger.info('Rules caches updated.');
  } else {
    logger.error('Failed to deploy rules.');
    exit(1);
  }
};

/**
 * The rules command definition.
 */
export const rulesCommand = new Command('rules')
  .description('Deploys Firestore, Storage rules, and indexes.')
  .option('--flavor <flavor>', 'The flavor to use for deployment.', 'development')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--only <only>', 'Only deploy the specified components (e.g., "firestore,storage").')
  .option('--force', 'Force deploy all rules, even if no files changed.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).',
    'global'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(rulesAction);
