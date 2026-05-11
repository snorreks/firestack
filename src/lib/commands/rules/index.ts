import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { CacheContext, RulesCliOptions, RulesCommandOptions } from '$types';
import { loadChecksums } from '$utils/checksum.ts';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';
import { getCacheContext, updateRemoteCache } from '$utils/functions_cache.ts';
import { getRulesOptions } from '$utils/options.ts';
import { findRuleFiles, type RuleFile } from './utils/rule_files.ts';

type RulesOptions = RulesCliOptions;

/**
 * Main action for the rules command.
 */
export const rulesAction = async (
  cliOptions: RulesCliOptions & { cacheContext?: CacheContext }
) => {
  const rulesOptions = await getRulesOptions(cliOptions);

  if (!rulesOptions.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack config.'
      )
    );
    exit(1);
  }

  // 1. Fetch cache context
  const cacheContext =
    cliOptions.cacheContext ??
    (await getCacheContext({
      mode: rulesOptions.mode,
      cloudCacheFileName: rulesOptions.cloudCacheFileName,
    }));
  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  const rulesDir = join(cwd(), rulesOptions.rulesDirectory || 'src/rules');
  const allRuleFiles = await findRuleFiles(rulesOptions.rulesDirectory || 'src/rules');

  if (allRuleFiles.length === 0) {
    logger.warn(chalk.yellow('No rule or index files found to deploy.'));
    return;
  }

  // 2. Filter rules based on 'only' option
  let ruleFiles = allRuleFiles;
  if (rulesOptions.only) {
    const onlyTargets = rulesOptions.only.split(',').map((t) => t.trim());
    ruleFiles = allRuleFiles.filter((r) => onlyTargets.includes(r.type));
  }

  if (ruleFiles.length === 0) {
    logger.warn(chalk.yellow('No matching rule files found after filtering.'));
    return;
  }

  // 3. Detect changes in parallel
  const { rulesToDeploy, newChecksums, skippedRules } = await detectChanges({
    ruleFiles,
    rulesDir,
    previousCache,
    force: rulesOptions.force,
  });

  if (skippedRules.length > 0) {
    logger.debug(
      chalk.yellow(
        `⏭️  Skipped rules (${skippedRules.length}): ${chalk.dim(skippedRules.join(', '))}`
      )
    );
  }

  if (rulesToDeploy.length === 0) {
    if (skippedRules.length === 0) {
      logger.info(chalk.green('✅ No changes detected in rules or indexes. Skipping deployment.'));
    }
    return;
  }

  logger.info(`🔍 Found ${chalk.bold.cyan(rulesToDeploy.length)} rule/index file(s) to deploy.`);

  // 4. Prepare deployment in a temporary directory
  const tempDirectory = await prepareDeploymentDirectory(rulesToDeploy, rulesDir);

  // 5. Execute deployment
  const success = await executeDeployment({
    rulesToDeploy,
    tempDirectory,
    rulesOptions,
  });

  if (!success) {
    logger.error(chalk.red('❌ Failed to deploy rules.'));
    exit(1);
  }

  logger.info(chalk.bold.green('✅ Rules and indexes deployed successfully.'));

  // 6. Update caches in parallel
  const cachesUpdated = await updateCaches({
    rulesOptions,
    newChecksums,
    previousCache,
    remoteUtils,
  });
  if (cachesUpdated) {
    logger.info(chalk.dim('🌐 Caches synchronized.'));
  }
};

type ChangeDetectionResult = {
  rulesToDeploy: RuleFile[];
  newChecksums: Record<string, string>;
  skippedRules: string[];
};

type DetectChangesOptions = {
  ruleFiles: RuleFile[];
  rulesDir: string;
  previousCache: Record<string, string>;
  force?: boolean;
};

/**
 * Detects which rule files have changed.
 */
const detectChanges = async (opts: DetectChangesOptions): Promise<ChangeDetectionResult> => {
  const { ruleFiles, rulesDir, previousCache, force } = opts;
  const algorithm = 'md5';
  const rulesToDeploy: RuleFile[] = [];
  const newChecksums: Record<string, string> = {};
  const skippedRules: string[] = [];

  const checkResults = await Promise.all(
    ruleFiles.map(async (rule) => {
      const sourcePath = join(rulesDir, rule.name);
      if (!(await exists(sourcePath))) return undefined;

      const content = await readFile(sourcePath, 'utf-8');
      const checksum = createHash(algorithm).update(content).digest('hex');
      const cacheKey = `rules:${rule.type}`;

      let hasChanged = true;
      if (!force) {
        const cachedChecksum = previousCache[cacheKey];
        if (checksum === cachedChecksum) {
          hasChanged = false;
        }
      }

      return { rule, checksum, cacheKey, hasChanged };
    })
  );

  for (const res of checkResults) {
    if (!res) continue;
    newChecksums[res.cacheKey] = res.checksum;
    if (res.hasChanged) {
      rulesToDeploy.push(res.rule);
    } else {
      skippedRules.push(res.rule.type);
    }
  }

  return { rulesToDeploy, newChecksums, skippedRules };
};

/**
 * Prepares a temporary directory with firebase.json and rule files.
 */
const prepareDeploymentDirectory = async (
  rulesToDeploy: RuleFile[],
  rulesDir: string
): Promise<string> => {
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const tempDirectory = join(cwd(), 'dist', `rules-deploy-${uniqueId}`);

  await mkdir(tempDirectory, { recursive: true });

  // Create firebase.json config
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

  // Write config and copy files in parallel
  await Promise.all([
    writeFile(join(tempDirectory, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2)),
    ...rulesToDeploy.map(async (rule) => {
      const sourcePath = join(rulesDir, rule.name);
      const destPath = join(tempDirectory, rule.name);
      await copyFile(sourcePath, destPath);
      logger.debug(`Copied ${rule.name} to deployment directory.`);
    }),
  ]);

  return tempDirectory;
};

/**
 * Executes the firebase deploy command.
 */
const executeDeployment = async (options: {
  rulesToDeploy: RuleFile[];
  tempDirectory: string;
  rulesOptions: RulesOptions;
}): Promise<boolean> => {
  const { rulesToDeploy, tempDirectory, rulesOptions } = options;

  const hasFirestore = rulesToDeploy.some(
    (r) => r.type === 'firestore' || r.type === 'firestoreIndexes'
  );
  const hasStorage = rulesToDeploy.some((r) => r.type === 'storage');

  const deployTargets: string[] = [];
  if (hasFirestore) deployTargets.push('firestore');
  if (hasStorage) deployTargets.push('storage');

  if (deployTargets.length === 0) return false;

  const projectId = rulesOptions.projectId;
  if (!projectId) {
    throw new Error('Project ID is required for deployment.');
  }

  const commandArgs = ['deploy', '--only', deployTargets.join(','), '--project', projectId];

  logger.info(`📡 Deploying targets: ${chalk.cyan(deployTargets.join(', '))}`);

  const result = await executeCommand('firebase', {
    args: commandArgs,
    cwd: tempDirectory,
    packageManager: rulesOptions.packageManager,
  });

  return result.success;
};

/**
 * Updates local and remote caches.
 */
const updateCaches = async (options: {
  rulesOptions: RulesCommandOptions;
  newChecksums: Record<string, string>;
  previousCache: Record<string, string>;
  remoteUtils: CacheContext['remoteUtils'];
}): Promise<boolean> => {
  const { rulesOptions, newChecksums, previousCache, remoteUtils } = options;
  const checksumsFolder = join(cwd(), 'dist', '.checksums', rulesOptions.mode);
  const updatePromises: Promise<void>[] = [];

  // Update local cache
  const updateLocalCache = async () => {
    if (!(await exists(checksumsFolder))) {
      await mkdir(checksumsFolder, { recursive: true });
    }
    const currentLocalChecksums = await loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      mode: rulesOptions.mode,
    });
    const updatedLocalChecksums = { ...currentLocalChecksums, ...newChecksums };
    await writeFile(
      join(checksumsFolder, 'checksums.json'),
      JSON.stringify(updatedLocalChecksums, null, 2)
    );
  };
  updatePromises.push(updateLocalCache());

  let remoteSuccess = true;
  // Update remote cache
  if (remoteUtils.updateCacheCallable) {
    const updatedRemoteCache = { ...previousCache, ...newChecksums };
    remoteSuccess = await updateRemoteCache({
      updateCacheCallable: remoteUtils.updateCacheCallable,
      mode: rulesOptions.mode,
      newCache: updatedRemoteCache,
    });
  }

  await Promise.all(updatePromises);
  return remoteSuccess;
};

/**
 * The rules command definition.
 */
export const rulesCommand = new Command('rules')
  .description('Deploys Firestore, Storage rules, and indexes.')
  .option('--mode <mode>', 'The mode to use for deployment.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--only <only>', 'Only deploy the specified components (e.g., "firestore,storage").')
  .option('--force', 'Force deploy all rules, even if no files changed.')
  .option(
    '--cloudCacheFileName <cloudCacheFileName>',
    'The name of the file used for the cloud cache.'
  )
  .option('--minify', 'Will minify the functions.')
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .action(rulesAction);
