import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import {
  type CacheContext,
  getCacheContext,
  updateRemoteCache,
} from '$commands/deploy/utils/functions_cache.js';
import { type DeployOptions, getOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { loadChecksums } from '$utils/checksum.js';
import { executeCommand } from '$utils/command.js';
import { exists } from '$utils/common.js';
import { findRuleFiles, type RuleFile } from './utils/rule_files.js';

/**
 * Options for the rules command.
 */
interface RulesOptions extends DeployOptions {
  only?: string;
  force?: boolean;
  cacheContext?: CacheContext;
}

/**
 * Main action for the rules command.
 */
export const rulesAction = async (cliOptions: RulesOptions) => {
  const options = await getOptions(cliOptions);

  if (!options.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      )
    );
    exit(1);
  }

  // 1. Fetch cache context
  const cacheContext = cliOptions.cacheContext ?? (await getCacheContext(options.flavor));
  const { remoteUtils, mergedCache: previousCache } = cacheContext;

  const rulesDir = join(cwd(), options.rulesDirectory || 'src/rules');
  const allRuleFiles = await findRuleFiles(options.rulesDirectory || 'src/rules');

  if (allRuleFiles.length === 0) {
    logger.warn(chalk.yellow('No rule or index files found to deploy.'));
    return;
  }

  // 2. Filter rules based on 'only' option
  let ruleFiles = allRuleFiles;
  if (options.only) {
    const onlyTargets = options.only.split(',').map((t) => t.trim());
    ruleFiles = allRuleFiles.filter((r) => onlyTargets.includes(r.type));
  }

  if (ruleFiles.length === 0) {
    logger.warn(chalk.yellow('No matching rule files found after filtering.'));
    return;
  }

  // 3. Detect changes in parallel
  const { rulesToDeploy, newChecksums } = await detectChanges(
    ruleFiles,
    rulesDir,
    previousCache,
    options.force
  );

  if (rulesToDeploy.length === 0) {
    logger.info(chalk.green('✅ No changes detected in rules or indexes. Skipping deployment.'));
    return;
  }

  logger.info(`🔍 Found ${chalk.bold.cyan(rulesToDeploy.length)} rule/index file(s) to deploy.`);

  // 4. Prepare deployment in a temporary directory
  const tempDir = await prepareDeploymentDir(rulesToDeploy, rulesDir);

  // 5. Execute deployment
  const success = await executeDeployment(rulesToDeploy, tempDir, options);

  if (!success) {
    logger.error(chalk.red('❌ Failed to deploy rules.'));
    exit(1);
  }

  logger.info(chalk.bold.green('✅ Rules and indexes deployed successfully.'));

  // 6. Update caches in parallel
  const cachesUpdated = await updateCaches(options, newChecksums, previousCache, remoteUtils);
  if (cachesUpdated) {
    logger.info(chalk.dim('🌐 Caches synchronized.'));
  }
};

interface ChangeDetectionResult {
  rulesToDeploy: RuleFile[];
  newChecksums: Record<string, string>;
}

/**
 * Detects which rule files have changed.
 */
async function detectChanges(
  ruleFiles: RuleFile[],
  rulesDir: string,
  previousCache: Record<string, string>,
  force?: boolean
): Promise<ChangeDetectionResult> {
  const algorithm = 'md5';
  const rulesToDeploy: RuleFile[] = [];
  const newChecksums: Record<string, string> = {};

  const checkResults = await Promise.all(
    ruleFiles.map(async (rule) => {
      const sourcePath = join(rulesDir, rule.name);
      if (!(await exists(sourcePath))) return null;

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
      logger.info(chalk.dim(`${res.rule.type} rules have not changed, skipping.`));
    }
  }

  return { rulesToDeploy, newChecksums };
}

/**
 * Prepares a temporary directory with firebase.json and rule files.
 */
async function prepareDeploymentDir(rulesToDeploy: RuleFile[], rulesDir: string): Promise<string> {
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const tempDir = join(cwd(), 'dist', `rules-deploy-${uniqueId}`);

  await mkdir(tempDir, { recursive: true });

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
    writeFile(join(tempDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2)),
    ...rulesToDeploy.map(async (rule) => {
      const sourcePath = join(rulesDir, rule.name);
      const destPath = join(tempDir, rule.name);
      await copyFile(sourcePath, destPath);
      logger.debug(`Copied ${rule.name} to deployment directory.`);
    }),
  ]);

  return tempDir;
}

/**
 * Executes the firebase deploy command.
 */
async function executeDeployment(
  rulesToDeploy: RuleFile[],
  tempDir: string,
  options: RulesOptions
): Promise<boolean> {
  const hasFirestore = rulesToDeploy.some(
    (r) => r.type === 'firestore' || r.type === 'firestoreIndexes'
  );
  const hasStorage = rulesToDeploy.some((r) => r.type === 'storage');

  const deployTargets: string[] = [];
  if (hasFirestore) deployTargets.push('firestore');
  if (hasStorage) deployTargets.push('storage');

  if (deployTargets.length === 0) return false;

  const projectId = options.projectId;
  if (!projectId) {
    throw new Error('Project ID is required for deployment.');
  }

  const commandArgs = ['deploy', '--only', deployTargets.join(','), '--project', projectId];

  logger.info(`📡 Deploying targets: ${chalk.cyan(deployTargets.join(', '))}`);

  const result = await executeCommand('firebase', {
    args: commandArgs,
    cwd: tempDir,
    packageManager: options.packageManager,
  });

  return result.success;
}

/**
 * Updates local and remote caches.
 */
async function updateCaches(
  options: RulesOptions,
  newChecksums: Record<string, string>,
  previousCache: Record<string, string>,
  remoteUtils: {
    update?: (options: {
      flavor: string;
      newFunctionsCache: Record<string, string>;
    }) => Promise<void>;
  }
): Promise<boolean> {
  const checksumsFolder = join(cwd(), 'dist', '.checksums', options.flavor);
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
    await writeFile(
      join(checksumsFolder, 'checksums.json'),
      JSON.stringify(updatedLocalChecksums, null, 2)
    );
  };
  updatePromises.push(updateLocalCache());

  let remoteSuccess = true;
  // Update remote cache
  if (remoteUtils.update) {
    const updatedRemoteCache = { ...previousCache, ...newChecksums };
    remoteSuccess = await updateRemoteCache(remoteUtils.update, options.flavor, updatedRemoteCache);
  }

  await Promise.all(updatePromises);
  return remoteSuccess;
}

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
