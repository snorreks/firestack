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
  SyncCliOptions,
  SyncCommandOptions,
  TestRulesCliOptions,
  TestRulesCommandOptions,
} from '$types';
import { exists } from '$utils/common.ts';

type ConfigLoaderResult = {
  config: FirestackConfig;
  configPath: string;
};

/**
 * Attempts to load firestack.config.ts using jiti with tsconfig path alias support.
 * If the config exports a function (defineConfig callback), it calls it with
 * the given mode to resolve the final config.
 */
const loadTsConfig = async (configPath: string): Promise<ConfigLoaderResult | undefined> => {
  if (!(await exists(configPath))) {
    return undefined;
  }

  try {
    // Dynamic import of jiti — it's a CJS module, loaded lazily
    const { createJiti } = await import('jiti');
    const jiti = createJiti(configPath, {
      // Let jiti auto-discover tsconfig.json by walking up from configPath
      // to resolve path aliases (@myproject/constants → real path)
    });

    const mod = (await jiti.import(configPath)) as Record<string, unknown>;
    const raw = (mod.default ?? mod) as
      | FirestackConfig
      | ((params: { mode?: string }) => FirestackConfig);

    let config: FirestackConfig;
    if (typeof raw === 'function') {
      // Call with undefined mode first to get the base config structure
      // (just to read modes, region, etc.)
      config = raw({ mode: undefined });
    } else {
      config = raw;
    }

    logger.debug(`Using configuration from ${configPath}`);

    return { config, configPath };
  } catch (error) {
    logger.error(`Failed to load ${configPath}: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Attempts to load firestack.json.
 * Also handles backward compatibility: if the JSON config has `flavors`
 * (the old key name), it maps it to `modes`.
 */
const loadJsonConfig = async (configPath: string): Promise<ConfigLoaderResult | undefined> => {
  if (!(await exists(configPath))) {
    return undefined;
  }

  try {
    const configContent = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(configContent);

    // Backward compatibility: map old `flavors` key to `modes`
    const config: FirestackConfig = {
      ...parsed,
      modes: parsed.modes ?? parsed.flavors,
    };

    logger.debug(`Using configuration from ${configPath}`);

    return { config, configPath };
  } catch (error) {
    logger.error(`Failed to read ${configPath}: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Resolves the config for a given mode by calling the config factory with
 * the mode if the config is a factory function.
 *
 * This is used when the mode is known (e.g., from CLI or default) and we
 * need to re-evaluate a defineConfig callback with the resolved mode.
 */
const _resolveConfigForMode = async (
  configPath: string,
  mode: string
): Promise<FirestackConfig> => {
  if (!configPath.endsWith('.ts')) {
    // JSON config doesn't need re-resolution
    return {};
  }

  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(configPath);

    const mod = (await jiti.import(configPath)) as Record<string, unknown>;
    const raw = (mod.default ?? mod) as
      | FirestackConfig
      | ((params: { mode?: string }) => FirestackConfig);

    if (typeof raw === 'function') {
      return raw({ mode });
    }

    return raw;
  } catch (error) {
    logger.error(`Failed to resolve config for mode '${mode}': ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Loads the firestack configuration.
 * Tries firestack.config.ts first, then falls back to firestack.json.
 *
 * For TS configs that use the defineConfig callback pattern, this loads the
 * base structure (with mode=undefined) to extract default values like modes.
 * Call `resolveConfigForMode` separately when the actual mode is known.
 */
export const getFirestackConfig = async (): Promise<FirestackConfig> => {
  const tsConfigPath = join(cwd(), 'firestack.config.ts');
  const jsonConfigPath = join(cwd(), 'firestack.json');

  // 1. Try TypeScript config first
  const tsResult = await loadTsConfig(tsConfigPath);
  if (tsResult) {
    return tsResult.config;
  }

  // 2. Fall back to JSON config
  const jsonResult = await loadJsonConfig(jsonConfigPath);
  if (jsonResult) {
    return jsonResult.config;
  }

  logger.debug('No firestack.config.ts or firestack.json found, using default options.');
  return {};
};

const getFirstMode = (config: FirestackConfig): string | undefined => {
  const modes = config.modes ?? {};
  return Object.keys(modes)[0];
};

/**
 * Gets base options by merging CLI options with firestack configuration.
 */
export const getBaseOptions = async (cliOptions: BaseCliOptions) => {
  const config = await getFirestackConfig();
  const firstMode = getFirstMode(config);
  const mode = cliOptions.mode ?? firstMode;

  if (!mode) {
    throw new Error(
      'Mode is required. Please provide a mode via CLI or configure in firestack config.'
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
  const force = cliOptions.noForce ? false : (cliOptions.force ?? config.force ?? false);

  return {
    config,
    mode,
    functionsDirectory:
      cliOptions.functionsDirectory || config.functionsDirectory || 'src/controllers',
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory || 'src/rules',
    firestoreRules: cliOptions.firestoreRules || config.firestoreRules,
    storageRules: cliOptions.storageRules || config.storageRules,
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory || 'scripts',
    initScript: cliOptions.initScript || config.initScript || 'on_emulate.ts',
    region: cliOptions.region || config.region || 'us-central1',
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    projectId: cliOptions.projectId || config.modes?.[mode],
    engine: cliOptions.engine || config.engine || 'bun',
    minify,
    sourcemap,
    watch,
    init,
    force,
    external: cliOptions.external || config.external || [],
    packageManager: cliOptions.packageManager || config.packageManager || 'global',
    emulators: cliOptions.emulators || config.emulators,
    emulatorPorts: cliOptions.emulatorPorts || config.emulatorPorts,
    keepNames: cliOptions.keepNames ?? config.keepNames,
    tsconfig: cliOptions.tsconfig,
    cloudCacheFileName:
      cliOptions.cloudCacheFileName || config.cloudCacheFileName || 'functions-cache.ts',
    includeFilePath: cliOptions.includeFilePath || config.includeFilePath || 'src/logger.ts',
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
    mode: base.mode,
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
    mode: base.mode,
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
    mode: base.mode,
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
    mode: base.mode,
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
      'Project ID is required. Please provide it via CLI or configure in firestack config.'
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
    mode: base.mode,
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
      'Project ID is required. Please provide it via CLI or configure in firestack config.'
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
    mode: base.mode,
  };

  logger.setLogSeverity(options);
  logger.debug('Deploying rules...');
  logger.debug('Options:', options);

  return options;
};

export const getSyncOptions = async (cliOptions: SyncCliOptions): Promise<SyncCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  if (!base.projectId) {
    throw new Error(
      'Project ID is required. Please provide it via CLI or configure in firestack config.'
    );
  }

  const options: SyncCommandOptions = {
    ...base,
    ...cliOptions,
    projectId: base.projectId,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch: base.watch,
    init: base.init,
    mode: base.mode,
  };

  logger.setLogSeverity(options);
  logger.debug('Syncing rules and indexes...');
  logger.debug('Options:', options);

  return options;
};

export const getBuildOptions = async (cliOptions: BaseCliOptions) => {
  const config = await getFirestackConfig();
  const firstMode = getFirstMode(config);
  const mode = cliOptions.mode ?? firstMode;

  const minify = cliOptions.noMinify ? false : (cliOptions.minify ?? config.minify ?? true);
  const sourcemap = cliOptions.noSourcemap
    ? false
    : (cliOptions.sourcemap ?? config.sourcemap ?? true);

  return {
    config,
    mode,
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    minify,
    sourcemap,
    external: cliOptions.external || config.external || [],
    tsconfig: cliOptions.tsconfig,
  };
};

export const getTestRulesOptions = async (
  cliOptions: TestRulesCliOptions
): Promise<TestRulesCommandOptions> => {
  const base = await getBaseOptions(cliOptions);

  // Watch should default to false for rules tests unless explicitly enabled
  const watch = cliOptions.watch ?? false;

  const options: TestRulesCommandOptions = {
    ...base,
    ...cliOptions,
    minify: base.minify,
    sourcemap: base.sourcemap,
    watch,
    mode: base.mode,
  };

  logger.setLogSeverity(options);
  logger.debug('Starting rules tests...');
  logger.debug('Options:', options);

  return options;
};
