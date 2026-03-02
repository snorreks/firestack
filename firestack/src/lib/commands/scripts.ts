import { join } from 'node:path';
import { Command } from 'commander';
import { execa } from 'execa';
import prompts from 'prompts';
import { logger } from '$logger';
import { findProjectRoot } from '$utils/common.js';
import { getScriptEnvironment } from '$utils/env.js';
import { cwdDir, exitCode, readDir, readTextFile } from '$utils/node-shim.js';

interface ScriptsOptions {
  flavor: string;
  scriptsDirectory?: string;
  verbose?: boolean;
  silent?: boolean;
}

interface FirestackConfig {
  scriptsDirectory?: string;
}

async function getOptions(cliOptions: ScriptsOptions): Promise<ScriptsOptions> {
  const configPath = join(cwdDir(), 'firestack.json');
  let config: FirestackConfig = {};
  try {
    const configContent = await readTextFile(configPath);
    config = JSON.parse(configContent);
    logger.debug(`Using configuration from ${configPath}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug('firestack.json not found, using command-line options.');
    } else {
      logger.error(`Failed to read firestack.json at ${configPath}: ${error.message}`);
      exitCode(1);
    }
  }

  const options: ScriptsOptions = {
    ...cliOptions,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory || 'scripts',
  };

  logger.setLogSeverity(cliOptions);
  logger.debug('Starting script command...');
  logger.debug('Options:', options);
  logger.debug('Current working directory:', cwdDir());
  logger.debug('Scripts directory:', options.scriptsDirectory);

  return options;
}

async function findScripts(dir: string): Promise<string[]> {
  const scripts: string[] = [];
  try {
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'init.ts') {
        scripts.push(entry.name.replace('.ts', ''));
      }
    }
  } catch {
    logger.debug(`Scripts directory ${dir} not found`);
  }
  return scripts;
}

async function runScript(scriptName: string, options: ScriptsOptions, projectRoot: string) {
  const scriptsPath = join(cwdDir(), options.scriptsDirectory!);
  const scriptPath = join(scriptsPath, `${scriptName}.ts`);
  const packageJsonPath = join(projectRoot, 'package.json');

  logger.debug('Script details:');
  logger.debug('  scriptsPath:', scriptsPath);
  logger.debug('  scriptPath:', scriptPath);
  logger.debug('  packageJsonPath:', packageJsonPath);

  const env = await getScriptEnvironment(options.flavor);

  logger.debug(`Running command: bun run "${scriptPath}"`);

  try {
    await execa('bun', ['run', scriptPath], {
      cwd: cwdDir(),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    logger.info('\n✅ Script finished successfully!');
  } catch (error) {
    const err = error as { exitCode?: number; cause?: Error };
    logger.error(`\n❌ Error running script. Exit code: ${err.exitCode ?? 'unknown'}`);
    if (err.cause) {
      logger.error(`Cause: ${err.cause.message}`);
    }
    exitCode(err.exitCode ?? 1);
  }
}

export const scriptsCommand = new Command('scripts')
  .description('Run a script from the scripts directory.')
  .option('--flavor <flavor>', 'The flavor to use.', 'development')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .argument('[scriptName]', 'The name of the script to run.')
  .action(async (scriptName: string | undefined, cliOptions: ScriptsOptions) => {
    const options = await getOptions(cliOptions);
    const scriptsPath = join(cwdDir(), options.scriptsDirectory!);

    let selectedScriptName: string;

    if (scriptName) {
      selectedScriptName = scriptName;
    } else {
      const scriptFiles = await findScripts(scriptsPath);
      if (scriptFiles.length === 0) {
        logger.warn('No scripts found.');
        return;
      }

      if (scriptFiles.length === 1) {
        selectedScriptName = scriptFiles[0];
        logger.info(`Running single script: ${selectedScriptName}`);
      } else {
        const response = await prompts({
          type: 'select',
          name: 'script',
          message: 'Please select a script to run:',
          choices: scriptFiles.map((script) => ({ title: script, value: script })),
        });

        if (!response.script) {
          logger.warn('No script selected. Exiting.');
          return;
        }
        selectedScriptName = response.script;
      }
    }

    const projectRoot = await findProjectRoot();
    await runScript(selectedScriptName, options, projectRoot);
  });
