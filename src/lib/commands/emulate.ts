import { watch } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { Command } from 'commander';
import { logger } from '$logger';
import { executeCommand } from '$utils/command.js';
import { exists } from '$utils/common.js';
import { getEnvironment } from './deploy/utils/environment.js';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';

async function runOnEmulate(options: DeployOptions) {
  const initScriptPath = join(
    cwd(),
    options.scriptsDirectory || 'scripts',
    options.initScript || 'on_emulate.ts'
  );

  if (!(await exists(initScriptPath))) {
    logger.debug(`No init script found at ${initScriptPath}`);
    return;
  }

  const env = await getEnvironment(options.flavor);

  logger.info(`Running init script: ${initScriptPath}`);
  await executeCommand('bun', {
    args: [initScriptPath],
    env: { ...process.env, ...env },
  });
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
    const configPath = join(projectRoot, 'firestack.json');

    // Watch for changes in firestack.json to restart emulator if needed
    // (This is a simplified version, real emulator restart might be more complex)
    if (await exists(configPath)) {
      watch(configPath, async (event) => {
        if (event === 'change') {
          logger.info('firestack.json changed, please restart emulator if needed.');
        }
      });
    }

    const firebaseConfigPath = join(projectRoot, 'firebase.json');
    if (!(await exists(firebaseConfigPath))) {
      logger.info('firebase.json not found, creating a basic one for emulation...');
      // In a real scenario, you might want to generate this from firestack.json
    }

    // Run the emulator
    logger.info('Starting Firebase emulator...');

    const emulatorProcess = executeCommand('firebase', {
      args: ['emulators:start', '--project', options.projectId || 'demo-project'],
      packageManager: options.packageManager,
    });

    // Run the init script after a short delay to let emulator start
    setTimeout(async () => {
      await runOnEmulate(options);
    }, 5000);

    const result = await emulatorProcess;
    if (!result.success) {
      logger.error('Emulator failed to start or exited with error.');
      exit(result.code);
    }
  });
