import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { execa } from 'execa';
import prompts from 'prompts';
import type { PackageManager } from '$commands/deploy/utils/options.ts';
import { logger } from '$logger';
import { exists } from '$utils/common.ts';
import { getScriptEnvironment } from '$utils/env.ts';

type ScriptsOptions = {
  flavor: string;
  scriptsDirectory?: string;
  verbose?: boolean;
  silent?: boolean;
  engine?: string;
  packageManager?: PackageManager;
};

type ScriptConfig = {
  config?: Record<string, unknown>;
};

/**
 * Loads script configuration for a specific flavor.
 */
const getScriptConfig = async (flavor: string): Promise<Record<string, unknown>> => {
  const configPath = join(cwd(), `script-config.${flavor}.ts`);

  if (!(await exists(configPath))) return {};

  try {
    const configModule = (await import(configPath)) as ScriptConfig;
    return configModule.config ?? {};
  } catch (_error) {
    logger.debug(chalk.dim(`No custom config loaded from script-config.${flavor}.ts`));
    return {};
  }
};

/**
 * Merges CLI options with firestack.json configuration.
 */
const getOptions = async (cliOptions: ScriptsOptions): Promise<ScriptsOptions> => {
  const configPath = join(cwd(), 'firestack.json');
  let config: Record<string, unknown> = {};

  if (await exists(configPath)) {
    try {
      const configContent = await readFile(configPath, 'utf-8');
      config = JSON.parse(configContent) as Record<string, unknown>;
      logger.debug(chalk.dim(`Using configuration from ${configPath}`));
    } catch (e) {
      logger.error(chalk.red(`❌ Failed to parse firestack.json: ${(e as Error).message}`));
      exit(1);
    }
  }

  const options: ScriptsOptions = {
    ...cliOptions,
    scriptsDirectory:
      cliOptions.scriptsDirectory || (config.scriptsDirectory as string | undefined) || 'scripts',
    engine: cliOptions.engine || (config.engine as string | undefined) || 'bun',
    packageManager:
      cliOptions.packageManager ||
      (config.packageManager as PackageManager | undefined) ||
      'global',
  };

  logger.setLogSeverity(cliOptions);
  return options;
};

/**
 * Finds all executable scripts in the scripts directory.
 */
const findScripts = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'on_emulate.ts')
      .map((e) => e.name.replace('.ts', ''));
  } catch {
    logger.debug(chalk.dim(`Scripts directory ${dir} not found`));
    return [];
  }
};

/**
 * Executes a specific script with environment variables and configuration.
 */
const runScript = async (scriptName: string, options: ScriptsOptions) => {
  const scriptsDirectory = options.scriptsDirectory;
  if (!scriptsDirectory) {
    throw new Error('Scripts directory is required.');
  }
  const scriptsPath = join(cwd(), scriptsDirectory);
  const scriptPath = join(scriptsPath, `${scriptName}.ts`);

  // Parallel fetch of environment and config
  const [env, scriptConfig] = await Promise.all([
    getScriptEnvironment({ flavor: options.flavor }),
    getScriptConfig(options.flavor),
  ]);

  if (Object.keys(scriptConfig).length > 0) {
    env.SCRIPT_CONFIG = JSON.stringify(scriptConfig);
  }

  const engine = options.engine || 'bun';
  const relativeScriptPath = relative(cwd(), scriptPath);
  const args = engine === 'bun' ? [relativeScriptPath] : ['run', relativeScriptPath];

  logger.info(chalk.cyan(`🏃 Executing script: ${chalk.bold(scriptName)}`));
  logger.debug(chalk.dim(`Command: ${engine} ${args.join(' ')}`));

  try {
    await execa(engine, args, {
      cwd: cwd(),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    logger.info(chalk.bold.green('\n✅ Script finished successfully!'));
  } catch (error) {
    const err = error as { exitCode?: number; cause?: Error };
    logger.error(chalk.red(`\n❌ Error running script. Exit code: ${err.exitCode ?? 'unknown'}`));
    exit(err.exitCode ?? 1);
  }
};

/**
 * Command to run a script from the scripts directory.
 */
export const scriptsCommand = new Command('scripts')
  .description('Run a script from the scripts directory.')
  .option('--flavor <flavor>', 'The flavor to use.')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .option('--engine <engine>', 'The engine to use (e.g., "bun", "node").')
  .argument('[scriptName]', 'The name of the script to run.')
  .action(async (scriptName: string | undefined, cliOptions: ScriptsOptions) => {
    const options = await getOptions(cliOptions);
    const scriptsDirectory = options.scriptsDirectory;
    if (!scriptsDirectory) {
      throw new Error('Scripts directory is required.');
    }
    const scriptsPath = join(cwd(), scriptsDirectory);

    let selectedScriptName = scriptName;

    if (!selectedScriptName) {
      const scriptFiles = await findScripts(scriptsPath);

      if (scriptFiles.length === 0) {
        logger.warn(chalk.yellow('⚠️  No scripts found in the scripts directory.'));
        return;
      }

      if (scriptFiles.length === 1) {
        selectedScriptName = scriptFiles[0];
        logger.info(chalk.dim(`Selected single available script: ${selectedScriptName}`));
      } else {
        const response = await prompts({
          type: 'select',
          name: 'script',
          message: 'Please select a script to run:',
          choices: scriptFiles.map((s) => ({ title: s, value: s })),
        });

        if (!response.script) return;
        selectedScriptName = response.script as string;
      }
    }

    if (!selectedScriptName) {
      logger.error(chalk.red('❌ No script selected.'));
      return;
    }

    await runScript(selectedScriptName, options);
  });
