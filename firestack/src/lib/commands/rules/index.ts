import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { Command } from 'commander';
import { type DeployOptions, getOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';
import { findRuleFiles } from './utils/rule_files.js';

/**
 * Options for the rules command.
 */
interface RulesOptions extends DeployOptions {
  only?: string;
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
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).',
    'global'
  )
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .action(async (cliOptions: RulesOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      exit(1);
    }

    const _rulesDir = join(cwd(), options.rulesDirectory || 'src/rules');
    const ruleFiles = await findRuleFiles(options.rulesDirectory || 'src/rules');

    if (ruleFiles.length === 0) {
      logger.warn('No rule or index files found to deploy.');
      return;
    }

    logger.info(`Found ${ruleFiles.length} rule/index file(s) to deploy.`);

    // Create a temporary directory for deployment
    const tempDir = join(cwd(), 'dist', 'rules-deploy');
    await mkdir(join(tempDir), { recursive: true });

    // Create firebase.json
    const firebaseConfig: Record<string, unknown> = {};
    for (const rule of ruleFiles) {
      if (rule.type === 'firestore') {
        firebaseConfig.firestore = { rules: rule.name };
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
    const hasFirestore = ruleFiles.some(
      (r) => r.type === 'firestore' || r.type === 'firestoreIndexes'
    );
    const hasStorage = ruleFiles.some((r) => r.type === 'storage');

    if (!hasFirestore && !hasStorage) {
      logger.warn('No firestore or storage rules found to deploy.');
      return;
    }

    writeFileSync(join(tempDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));

    // Copy rule files to temp dir
    for (const rule of ruleFiles) {
      const sourcePath = join(cwd(), options.rulesDirectory || 'src/rules', rule.name);
      const destPath = join(tempDir, rule.name);
      if (existsSync(sourcePath)) {
        copyFileSync(sourcePath, destPath);
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
    } else {
      logger.error('Failed to deploy rules.');
      exit(1);
    }
  });
