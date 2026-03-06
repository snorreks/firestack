import { watch } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';
import { exists } from '$utils/common.js';
import { getEnvironment } from './deploy/utils/environment.js';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';

/**
 * Runs the initialization script for the emulator.
 */
async function runOnEmulate(options: DeployOptions) {
  const scriptsDir = options.scriptsDirectory || 'scripts';
  const initScript = options.initScript || 'on_emulate.ts';
  const initScriptPath = join(cwd(), scriptsDir, initScript);

  if (!(await exists(initScriptPath))) {
    logger.debug(chalk.dim(`No init script found at ${initScriptPath}`));
    return;
  }

  const env = await getEnvironment(options.flavor);

  logger.info(chalk.cyan(`🏃 Running init script: ${chalk.bold(initScript)}`));

  try {
    await executeCommand('bun', {
      args: [initScriptPath],
      env: { ...process.env, ...env },
    });
    logger.info(chalk.green('✅ Init script completed.'));
  } catch (error) {
    logger.error(chalk.red(`❌ Init script failed: ${(error as Error).message}`));
  }
}

/**
 * Command to run the Firebase emulator.
 */
export const emulateCommand = new Command('emulate')
  .description('Runs the Firebase emulator.')
  .option('--flavor <flavor>', 'The flavor to use.', 'development')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .action(async (cliOptions: DeployOptions) => {
    const options = await getOptions(cliOptions);
    const projectRoot = cwd();

    logger.info(chalk.bold.green('🔥 Starting Firebase emulator...'));

    // 1. Configuration Watcher
    const configPath = join(projectRoot, 'firestack.json');
    if (await exists(configPath)) {
      watch(configPath, (event) => {
        if (event === 'change') {
          logger.info(
            chalk.yellow('⚠️  firestack.json changed. You may need to restart the emulator.')
          );
        }
      });
    }

    // 2. Firebase Config Check
    const firebaseConfigPath = join(projectRoot, 'firebase.json');
    if (!(await exists(firebaseConfigPath))) {
      logger.warn(
        chalk.yellow('⚠️  firebase.json not found. Emulation might not work as expected.')
      );
    }

    // 3. Start Emulator Process
    const emulatorProcess = executeCommand('firebase', {
      args: ['emulators:start', '--project', options.projectId || 'demo-project'],
      packageManager: options.packageManager,
    });

    // 4. Run post-startup initialization
    // We wait a bit for the emulator to actually start up before running the script
    const INIT_DELAY_MS = 5000;
    setTimeout(() => runOnEmulate(options), INIT_DELAY_MS);

    const result = await emulatorProcess;

    if (!result.success) {
      logger.error(chalk.red('❌ Emulator failed to start or exited with an error.'));
      exit(result.code || 1);
    }

    logger.info(chalk.green('👋 Emulator stopped.'));
  });
