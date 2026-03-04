import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { mkdir as mkdirProm } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '$logger';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';
import { findRuleFiles } from './rules/utils/rule_files.js';

function cwdDir(): string {
  return cwd();
}

function exitCode(code: number): never {
  return exit(code);
}

async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
  await mkdirProm(path, { recursive: options?.recursive ?? false });
}

interface RulesOptions extends DeployOptions {
  only?: string;
}

export const rulesCommand = new Command('rules')
  .description('Deploys Firestore, Storage rules, and indexes.')
  .option('--flavor <flavor>', 'The flavor to use for deployment.', 'development')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--only <only>', 'Only deploy the specified components (e.g., "firestore,storage").')
  .action(async (cliOptions: RulesOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      exitCode(1);
    }

    const _rulesDir = join(cwdDir(), options.rulesDirectory || 'src/rules');
    const ruleFiles = await findRuleFiles(options.rulesDirectory || 'src/rules');

    if (ruleFiles.length === 0) {
      logger.warn('No rule or index files found to deploy.');
      return;
    }

    logger.info(`Found ${ruleFiles.length} rule/index file(s) to deploy.`);

    // Create a temporary directory for deployment
    const tempDir = join(cwdDir(), 'dist', 'rules-deploy');
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
      const sourcePath = join(cwdDir(), options.rulesDirectory || 'src/rules', rule.name);
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
      options.projectId!,
    ];

    logger.info(`Deploying: ${deployTargets.join(', ')}`);
    logger.debug(`> firebase ${commandArgs.join(' ')}`);

    try {
      await execa('firebase', commandArgs, {
        cwd: tempDir,
        stdio: 'inherit',
      });

      logger.info('Rules and indexes deployed successfully.');
    } catch {
      logger.error('Failed to deploy rules.');
      exitCode(1);
    }
  });
