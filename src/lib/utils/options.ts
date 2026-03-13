import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { DEFAULT_NODE_VERSION } from '$constants';
import { logger } from '$logger';
import type {
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

// TODO: create a get base options method, and move all specific options into the commands

export const getDeployOptions = async (
  cliOptions: DeployCliOptions
): Promise<DeployCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const options: DeployCommandOptions = {
    ...cliOptions,
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
    minify: cliOptions.minify ?? config.minify ?? true,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap ?? true,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deployment...');
  logger.debug('Options:', options);

  return options;
};

export const getEmulateOptions = async (
  cliOptions: EmulateCliOptions
): Promise<EmulateCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const options: EmulateCommandOptions = {
    ...cliOptions,
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
    minify: cliOptions.minify ?? config.minify ?? true,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap ?? true,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting emulation...');
  logger.debug('Options:', options);

  return options;
};

export const getLogsOptions = async (cliOptions: LogsCliOptions): Promise<LogsCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const options: LogsCommandOptions = {
    ...cliOptions,
    flavor,
    functionsDirectory: cliOptions.functionsDirectory || config.functionsDirectory,
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory,
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory,
    initScript: cliOptions.initScript || config.initScript,
    region: cliOptions.region || config.region,
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion,
    projectId: cliOptions.projectId || (flavor ? config.flavors?.[flavor] : undefined),
    engine: cliOptions.engine || config.engine,
    minify: cliOptions.minify ?? config.minify,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap,
    external: cliOptions.external || config.external,
    packageManager: cliOptions.packageManager || config.packageManager,
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Fetching logs...');
  logger.debug('Options:', options);

  return options;
};

export const getScriptsOptions = async (
  cliOptions: ScriptsCliOptions
): Promise<ScriptsCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const options: ScriptsCommandOptions = {
    ...cliOptions,
    flavor,
    functionsDirectory: cliOptions.functionsDirectory || config.functionsDirectory,
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory,
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory || 'scripts',
    initScript: cliOptions.initScript || config.initScript,
    region: cliOptions.region || config.region,
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion,
    projectId: cliOptions.projectId || (flavor ? config.flavors?.[flavor] : undefined),
    engine: cliOptions.engine || config.engine || 'bun',
    minify: cliOptions.minify ?? config.minify,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap,
    external: cliOptions.external || config.external,
    packageManager: cliOptions.packageManager || config.packageManager,
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Running script...');
  logger.debug('Options:', options);

  return options;
};

export const getDeleteOptions = async (
  cliOptions: DeleteCliOptions
): Promise<DeleteCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const projectId = cliOptions.projectId || config.flavors?.[flavor];

  if (!projectId) {
    throw new Error(
      'Project ID is required. Please provide it via CLI or configure in firestack.json'
    );
  }

  const options: DeleteCommandOptions = {
    ...cliOptions,
    flavor,
    projectId,
    functionsDirectory:
      cliOptions.functionsDirectory || config.functionsDirectory || 'src/controllers',
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory || 'src/rules',
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory,
    initScript: cliOptions.initScript || config.initScript,
    region: cliOptions.region || config.region || 'us-central1',
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    engine: cliOptions.engine || config.engine || 'bun',
    minify: cliOptions.minify ?? config.minify ?? true,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap ?? true,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deletion...');
  logger.debug('Options:', options);

  return options;
};

export const getRulesOptions = async (
  cliOptions: RulesCliOptions
): Promise<RulesCommandOptions> => {
  const config = await getFirestackConfig();
  const firstFlavor = getFirstFlavor(config);
  const flavor = cliOptions.flavor ?? firstFlavor;

  if (!flavor) {
    throw new Error(
      'Flavor is required. Please provide a flavor via CLI or configure in firestack.json'
    );
  }

  const projectId = cliOptions.projectId || config.flavors?.[flavor];

  if (!projectId) {
    throw new Error(
      'Project ID is required. Please provide it via CLI or configure in firestack.json'
    );
  }

  const options: RulesCommandOptions = {
    ...cliOptions,
    flavor,
    projectId,
    functionsDirectory:
      cliOptions.functionsDirectory || config.functionsDirectory || 'src/controllers',
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory || 'src/rules',
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory,
    initScript: cliOptions.initScript || config.initScript,
    region: cliOptions.region || config.region || 'us-central1',
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    engine: cliOptions.engine || config.engine || 'bun',
    minify: cliOptions.minify ?? config.minify ?? true,
    sourcemap: cliOptions.sourcemap ?? config.sourcemap ?? true,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
  };

  logger.setLogSeverity(options);
  logger.debug('Deploying rules...');
  logger.debug('Options:', options);

  return options;
};
