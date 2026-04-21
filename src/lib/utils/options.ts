import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { DEFAULT_NODE_VERSION } from '$constants';
import { logger } from '$logger';
import type {
  BaseCliOptions,
  DeleteCliOptions,
  DeleteCommandOptions,
  DeployCliOptions,
  DeployCommandOptions,
  EmulateCliOptions,
  EmulateCommandOptions,
  FirestackConfig,
  LogsCliOptions,
  LogsCommandOptions,
  RulesCliOptions,
  RulesCommandOptions,
  ScriptsCliOptions,
  ScriptsCommandOptions,
} from '$types';

export const getFirestackConfig = async (): Promise<FirestackConfig> => {
  const configPath = join(cwd(), 'firestack.json');
  let config: FirestackConfig = {};
  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);
    logger.debug(`Using configuration from ${configPath}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug('firestack.json not found, using command-line options.');
    } else {
      logger.error(`Failed to read firestack.json at ${configPath}: ${error.message}`);
      throw error;
    }
  }

  return config;
};

const getFirstFlavor = (config: FirestackConfig): string | undefined => {
  const flavors = config.flavors ?? {};
  return Object.keys(flavors)[0];
};

/**
 * Gets base options by merging CLI options with firestack.json configuration.
 */
export const getBaseOptions = async (cliOptions: BaseCliOptions) => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  // Handle boolean flags with no- prefix correctly
  // Priority: CLI flag (true) -> CLI no-flag (false) -> Config -> Default
  const minify = cliOptions.noMinify ? false : (cliOptions.minify ?? config.minify ?? true);
  const sourcemap = cliOptions.noSourcemap
    ? false
    : (cliOptions.sourcemap ?? config.sourcemap ?? true);

  const watch = cliOptions.noWatch ? false : (cliOptions.watch ?? config.watch ?? true);
  const init = cliOptions.noInit ? false : (cliOptions.init ?? config.init ?? true);
  const kill = cliOptions.noKill ? false : (cliOptions.kill ?? config.kill ?? false);

  return {
    config,
    flavor,
    functionsDirectory:
      cliOptions.functionsDirectory || config.functionsDirectory || 'src/controllers',
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory || 'src/rules',
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory || 'scripts',
    initScript: cliOptions.initScript || config.initScript || 'on_emulate.ts',
    region: cliOptions.region || config.region || 'us-central1',
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    projectId: cliOptions.projectId || config.flavors?.[flavor],
    engine: cliOptions.engine || config.engine || 'bun',
    minify,
    sourcemap,
    watch,
    init,
    kill,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };
};

export const getDeployOptions = async (
  cliOptions: DeployCliOptions
): Promise<DeployCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  const options: DeployCommandOptions = {
    ...base,
    ...cliOptions,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deployment...');
  logger.debug('Options:', options);

  return options;
};

export const getEmulateOptions = async (
  cliOptions: EmulateCliOptions
): Promise<EmulateCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  const options: EmulateCommandOptions = {
    ...base,
    ...cliOptions,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting emulation...');
  logger.debug('Options:', options);

  return options;
};

export const getLogsOptions = async (cliOptions: LogsCliOptions): Promise<LogsCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  const options: LogsCommandOptions = {
    ...base,
    ...cliOptions,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Fetching logs...');
  logger.debug('Options:', options);

  return options;
};

export const getScriptsOptions = async (
  cliOptions: ScriptsCliOptions
): Promise<ScriptsCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  const options: ScriptsCommandOptions = {
    ...base,
    ...cliOptions,
    // Script should not have minify/sourcemap as it just runs a file
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Running script...');
  logger.debug('Options:', options);

  return options;
};

export const getDeleteOptions = async (
  cliOptions: DeleteCliOptions
): Promise<DeleteCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  if (!base.projectId) {
    throw new Error(
      'Project ID is required. Please provide it via CLI or configure in firestack.json'
    );
  }

  const options: DeleteCommandOptions = {
    ...base,
    ...cliOptions,
    projectId: base.projectId,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deletion...');
  logger.debug('Options:', options);

  return options;
};

export const getRulesOptions = async (
  cliOptions: RulesCliOptions
): Promise<RulesCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  if (!base.projectId) {
    throw new Error(
      'Project ID is required. Please provide it via CLI or configure in firestack.json'
    );
  }

  const options: RulesCommandOptions = {
    ...base,
    ...cliOptions,
    projectId: base.projectId,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    flavor: base.flavor,
  };

  logger.setLogSeverity(options);
  logger.debug('Deploying rules...');
  logger.debug('Options:', options);

  return options;
};
