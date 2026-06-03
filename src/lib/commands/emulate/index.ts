import { existsSync, readdirSync, readFileSync, watch } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import type { Subprocess } from 'execa';
import { toDeployIndexCode } from '$commands/deploy/utils/create_deploy_index.ts';
import { parseFunctionMetadata } from '$commands/deploy/utils/parse_function_metadata.ts';
import { DEFAULT_EMULATOR_PROJECT_ID } from '$constants';
import { logger } from '$logger';
import type { EmulateCommandOptions } from '$types';
import { buildFunction } from '$utils/build_utils.ts';
import { executeCommand } from '$utils/command.ts';
import { exists, findProjectRoot, openUrl } from '$utils/common.ts';
import { getEnvironment } from '$utils/environment';
import { findFunctions } from '$utils/find_functions.ts';
import { createPackageJson, toDotEnvironmentCode } from '$utils/firebase_utils.ts';
import { getEmulateOptions } from '$utils/options.ts';
import { forceCleanupEmulators } from '$utils/ports.ts';

/**
 * Resolves the chokidar polling mode.
 * - 'auto': checks if inotify watches are ≥ 90% consumed → enables polling with warning.
 * - true/false: explicit, no detection.
 *
 * Returns the resolved boolean and a warning message (if any).
 */
const resolveChokidarPolling = (
  pollingMode: boolean | 'auto'
): { enabled: boolean; warning?: string } => {
  if (pollingMode !== 'auto') {
    return { enabled: pollingMode };
  }

  try {
    const maxWatches = parseInt(
      readFileSync('/proc/sys/fs/inotify/max_user_watches', 'utf8').trim(),
      10
    );
    if (!maxWatches || maxWatches <= 0) return { enabled: false };

    // Count actual inotify watches by scanning /proc/*/fdinfo
    let used = 0;
    const procDirs = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
    for (const pidDir of procDirs) {
      try {
        const fdinfoDir = `/proc/${pidDir}/fdinfo`;
        for (const fdinfo of readdirSync(fdinfoDir)) {
          try {
            const content = readFileSync(`${fdinfoDir}/${fdinfo}`, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
              if (line.startsWith('inotify')) {
                const wdMatch = line.match(/inotify wd:([0-9,]+)/);
                if (wdMatch) {
                  used += wdMatch[1].split(',').length;
                }
              }
            }
          } catch {
            /* skip unreadable fdinfo */
          }
        }
      } catch {
        /* skip unreadable proc dir */
      }
    }

    const usageRatio = used / maxWatches;
    if (usageRatio >= 0.9) {
      const pct = Math.round(usageRatio * 100);
      return {
        enabled: true,
        warning: `Inotify watches ${pct}% consumed (${used}/${maxWatches}). Enabling chokidar polling to bypass kernel watcher limit. Consider increasing fs.inotify.max_user_watches in your kernel config.`,
      };
    }
  } catch {
    /* non-Linux or unreadable — skip auto-detect */
  }

  return { enabled: false };
};

type EmulateOptions = EmulateCommandOptions;

const defaultPorts = {
  ui: 4000,
  auth: 9099,
  functions: 5001,
  firestore: 8080,
  pubsub: 8085,
  storage: 9199,
  database: 9000,
  hosting: 5000,
  dataconnect: 9399,
} as const satisfies Record<string, number>;

/**
 * Runs the initialization script for the emulator.
 */
const runOnEmulate = async (options: EmulateOptions & { env: Record<string, string> }) => {
  const { env } = options;
  const scriptsDir = options.scriptsDirectory || 'scripts';
  const initScript = options.initScript || 'on_emulate.ts';
  const initScriptPath = join(process.cwd(), scriptsDir, initScript);

  if (!(await exists(initScriptPath))) {
    logger.debug(chalk.dim(`No init script found at ${initScriptPath}`));
    return;
  }

  const ports = {
    auth: options.emulatorPorts?.auth || defaultPorts.auth,
    firestore: options.emulatorPorts?.firestore || defaultPorts.firestore,
    storage: options.emulatorPorts?.storage || defaultPorts.storage,
    database: options.emulatorPorts?.database || defaultPorts.database,
  };

  const projectId = options.projectId || DEFAULT_EMULATOR_PROJECT_ID;

  // Pass emulator environment variables - start with fresh object to avoid inheriting any creds
  // Use the actual project ID for the emulator - it's fine as long as FIRESTORE_EMULATOR_HOST is set
  const emulatorEnv: Record<string, string> = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    USER: process.env.USER || '',
    SHELL: process.env.SHELL || '',
    GCP_PROJECT_ID: projectId,
    FIREBASE_PROJECT_ID: projectId,
    GCLOUD_PROJECT: projectId,
    GCP_PROJECT: projectId,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
    FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${ports.storage}`,
    FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${ports.database}`,
    FIREBASE_MODE: options.mode || '',
    // Suppress Java warnings in emulators
    JAVA_OPTS:
      '-XX:+IgnoreUnrecognizedVMOptions --add-opens=java.base/java.nio=ALL-UNNAMED --add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
    ...env,
  };

  logger.info(chalk.cyan(`🏃 Running init script: ${chalk.bold(initScript)}`));

  const projectRoot = process.cwd();
  const tsconfigPath = join(projectRoot, 'tsconfig.json');

  const result = await executeCommand('bun', {
    args: ['--tsconfig-override', tsconfigPath, initScriptPath, projectId],
    cwd: projectRoot,
    env: emulatorEnv as Record<string, string>,
  });

  if (result.success) {
    logger.info(chalk.green('✅ Init script completed.'));
  } else {
    logger.info(chalk.red(`❌ Init script failed: ${result.stderr || 'Unknown error'}`));
  }
};

/**
 * Builds all functions into a combined index.js for the emulator.
 */
const buildEmulatorFunctions = async (options: {
  functionFiles: string[];
  outputDir: string;
  emulateOptions: EmulateOptions;
  controllersPath: string;
  env: Record<string, string>;
}): Promise<void> => {
  const { functionFiles, outputDir, emulateOptions, controllersPath, env } = options;
  const projectRoot = await findProjectRoot();
  const tempDir = join(process.cwd(), 'tmp', 'emulator');

  await Promise.all([
    mkdir(tempDir, { recursive: true }),
    mkdir(join(outputDir, 'src'), { recursive: true }),
  ]);

  // Parse metadata for all functions
  const functionMetadataList = await Promise.all(
    functionFiles.map((functionPath) =>
      parseFunctionMetadata({
        functionPath,
        functionsDirectoryPath: controllersPath,
        defaultRegion: emulateOptions.region,
        defaultNodeVersion: emulateOptions.nodeVersion,
      })
    )
  );

  const imports: string[] = [];
  const exports: string[] = [];

  for (let i = 0; i < functionMetadataList.length; i++) {
    const metadata = functionMetadataList[i];
    if (!metadata) {
      continue;
    }

    const { functionPath, firestackOptions, functionOptions, deployFunction } = metadata;
    const functionName = firestackOptions.functionName || 'function';

    const code = await toDeployIndexCode({
      functionName,
      functionPath,
      temporaryDirectory: tempDir,
      functionsDirectoryPath: controllersPath,
      deployFunction,
      functionOptions,
      includeFilePath: emulateOptions.includeFilePath,
      projectRoot,
    });

    const lines = code.split('\n').filter((line: string) => line.trim() !== '');
    const importLines = lines.filter((line: string) => line.startsWith('import'));
    const otherLines = lines.filter((line: string) => !line.startsWith('import'));

    // Re-map imports to use unique names or just keep them if they are common
    for (const line of importLines) {
      if (!imports.includes(line)) {
        imports.push(line);
      }
    }

    exports.push(...otherLines);
  }

  const combinedIndexContent = `${imports.join('\n')}\n\n${exports.join('\n')}\n`;
  const tempIndexPath = join(tempDir, 'index.ts');
  await writeFile(tempIndexPath, combinedIndexContent);

  logger.debug('Generated combined index file');

  await buildFunction({
    inputFile: tempIndexPath,
    outputFile: join(outputDir, 'src', 'index.js'),
    configPath: join(projectRoot, 'package.json'),
    minify: emulateOptions.minify,
    sourcemap: emulateOptions.sourcemap,
    nodeVersion: emulateOptions.nodeVersion,
    tsconfig: emulateOptions.tsconfig,
  });

  const packageJson = await createPackageJson({
    nodeVersion: emulateOptions.nodeVersion,
    functionName: 'emulator',
    isEmulator: true,
    main: 'src/index.js',
  });

  await writeFile(join(outputDir, 'package.json'), packageJson);

  const emulatorEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key !== 'FIREBASE_SERVICE_ACCOUNT') {
      emulatorEnv[key] = value;
    }
  }

  if (Object.keys(emulatorEnv).length > 0) {
    await writeFile(join(outputDir, '.env'), toDotEnvironmentCode({ env: emulatorEnv }));
    logger.debug('Generated .env file for emulator');
  }

  if (!emulateOptions.debug) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

/**
 * Generates firebase.json for the emulator inside the output directory.
 * Also copies rules and index files to the output directory.
 */
const generateFirebaseJson = async (options: {
  outputDir: string;
  emulateOptions: EmulateOptions;
  functionFiles: string[];
}): Promise<void> => {
  const { outputDir, emulateOptions, functionFiles } = options;

  // 1. Collect potential emulators to enable
  const emulatorsToEnable = new Set<string>();

  // Compute dataconnect paths once (used for detection + config)
  const projectRoot = process.cwd();
  const dataconnectDir = join(projectRoot, emulateOptions.dataconnectDirectory || 'dataconnect');
  const dataconnectYamlPath = join(dataconnectDir, 'dataconnect.yaml');

  if (emulateOptions.emulators) {
    // User provided explicit list — use it as-is
    for (const e of emulateOptions.emulators) {
      emulatorsToEnable.add(e);
    }
  } else {
    // Auto-detect which emulators are needed based on project contents

    // Dataconnect: check if dataconnect.yaml exists
    if (existsSync(dataconnectYamlPath)) {
      emulatorsToEnable.add('dataconnect');
    }

    // Functions + Auth + Firestore: enabled when there are function files
    if (functionFiles.length > 0) {
      emulatorsToEnable.add('functions');
      emulatorsToEnable.add('auth');
      emulatorsToEnable.add('firestore');

      if (await checkHasScheduler(functionFiles)) {
        emulatorsToEnable.add('pubsub');
      }
    }

    // Firestore rules
    if (await hasRuleFile(emulateOptions, 'firestore')) {
      emulatorsToEnable.add('firestore');
    }

    // Storage rules
    if (await hasRuleFile(emulateOptions, 'storage')) {
      emulatorsToEnable.add('storage');
    }
  }

  const firebaseConfig: Record<string, unknown> = {
    emulators: {
      singleProjectMode: true,
      ui: { enabled: true, port: emulateOptions.emulatorPorts?.ui || defaultPorts.ui },
    },
  };

  if (functionFiles.length > 0) {
    firebaseConfig.functions = [
      {
        source: '.', // Relative to firebase.json in dist/emulator
        codebase: 'default',
        runtime: `nodejs${emulateOptions.nodeVersion}`,
      },
    ];
  }

  const emulators = firebaseConfig.emulators as Record<string, unknown>;

  const ports = { ...defaultPorts, ...emulateOptions.emulatorPorts };

  if (emulatorsToEnable.has('auth')) emulators.auth = { port: ports.auth };
  if (emulatorsToEnable.has('functions')) emulators.functions = { port: ports.functions };
  if (emulatorsToEnable.has('firestore')) emulators.firestore = { port: ports.firestore };
  if (emulatorsToEnable.has('pubsub')) emulators.pubsub = { port: ports.pubsub };
  if (emulatorsToEnable.has('storage')) emulators.storage = { port: ports.storage };
  if (emulatorsToEnable.has('database')) emulators.database = { port: ports.database };
  if (emulatorsToEnable.has('hosting')) emulators.hosting = { port: ports.hosting };
  if (emulatorsToEnable.has('dataconnect')) emulators.dataconnect = { port: ports.dataconnect };

  // 2. Rules and Indexes Handling
  await copyRulesAndIndexes({ outputDir, emulateOptions, firebaseConfig });

  // 3. Data Connect Configuration (only if detected)
  if (emulatorsToEnable.has('dataconnect')) {
    // Copy the dataconnect source directory into dist/emulator so Firebase CLI
    // can access it (relative paths going above the firebase.json directory are rejected).
    const dataconnectOutputDir = join(outputDir, 'dataconnect');
    await copyDataconnectDirectory(dataconnectDir, dataconnectOutputDir);

    firebaseConfig.dataconnect = {
      source: 'dataconnect',
    };
  }

  await writeFile(join(outputDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));
};

/**
 * Copies rules and index files to the emulator directory and updates the config.
 */
const copyRulesAndIndexes = async (options: {
  outputDir: string;
  emulateOptions: EmulateOptions;
  firebaseConfig: Record<string, unknown>;
}) => {
  const { outputDir, emulateOptions, firebaseConfig } = options;
  const projectRoot = process.cwd();

  // Helper to find and copy a file
  const findAndCopy = async (filename: string, configPath: string[]) => {
    const searchPaths = [
      join(projectRoot, filename),
      join(projectRoot, emulateOptions.rulesDirectory || 'src/rules', filename),
    ];

    for (const sourcePath of searchPaths) {
      if (existsSync(sourcePath)) {
        const destPath = join(outputDir, filename);
        const content = await readFile(sourcePath, 'utf-8');
        await writeFile(destPath, content);

        // Update firebaseConfig
        let nested = firebaseConfig;
        for (let i = 0; i < configPath.length - 1; i++) {
          const key = configPath[i];
          nested[key] = nested[key] || {};
          nested = nested[key] as Record<string, unknown>;
        }
        nested[configPath[configPath.length - 1]] = filename;
        return true;
      }
    }
    return false;
  };

  await Promise.all([
    findAndCopy('firestore.rules', ['firestore', 'rules']),
    findAndCopy('firestore.indexes.json', ['firestore', 'indexes']),
    findAndCopy('storage.rules', ['storage', 'rules']),
  ]);
};

/**
 * Checks if any of the function files use scheduled triggers.
 * Only checks the first 20 files for performance.
 * @param functionFiles - Array of function file paths.
 * @returns True if any file contains onSchedule or scheduler keywords.
 */
const checkHasScheduler = async (functionFiles: string[]): Promise<boolean> => {
  // Check first 20 files for performance
  const filesToCheck = functionFiles.slice(0, 20);
  const results = await Promise.all(
    filesToCheck.map(async (f) => {
      try {
        const content = await readFile(f, 'utf-8');
        return content.includes('onSchedule') || content.includes('scheduler');
      } catch {
        return false;
      }
    })
  );
  return results.some((r) => r);
};

/**
 * Checks if a rules file exists for the given emulator type.
 * Searches in the project root and the configured rules directory.
 * @param emulateOptions - The emulation options.
 * @param type - The type of rules to check for.
 * @returns True if the rules file exists.
 */
const hasRuleFile = async (
  emulateOptions: EmulateOptions,
  type: 'firestore' | 'storage'
): Promise<boolean> => {
  const filename = `${type}.rules`;
  const paths = [
    join(process.cwd(), filename),
    join(process.cwd(), emulateOptions.rulesDirectory || 'src/rules', filename),
  ];
  const results = await Promise.all(paths.map((p) => exists(p)));
  return results.some((r) => r);
};

/**
 * Copies the dataconnect source directory into the emulator output directory.
 */
const copyDataconnectDirectory = async (sourceDir: string, targetDir: string): Promise<void> => {
  const { cp } = await import('node:fs/promises');

  try {
    await cp(sourceDir, targetDir, { recursive: true });
    logger.debug(`Copied dataconnect directory to ${targetDir}`);
  } catch (error) {
    logger.warn(`Failed to copy dataconnect directory: ${(error as Error).message}`);
  }
};

/**
 * Watches for file changes and rebuilds.
 */
const watchAndRebuild = (options: {
  functionsPath: string;
  functionFiles: string[];
  outputDir: string;
  emulateOptions: EmulateOptions;
  controllersPath: string;
  env: Record<string, string>;
}): void => {
  const { functionsPath, functionFiles, outputDir, emulateOptions, controllersPath, env } = options;
  const projectRoot = process.cwd();
  logger.info(chalk.dim('Watching for file changes...'));

  // Watch functions
  const functionsWatcher = watch(functionsPath, { recursive: true });
  functionsWatcher.on('change', async (_eventType, filename) => {
    if (
      filename &&
      typeof filename === 'string' &&
      (filename.endsWith('.ts') || filename.endsWith('.tsx'))
    ) {
      logger.info(chalk.dim(`File changed: ${basename(filename)}, rebuilding...`));
      try {
        await buildEmulatorFunctions({
          functionFiles,
          outputDir,
          emulateOptions,
          controllersPath,
          env,
        });
        logger.info(chalk.green('Rebuild complete.'));
      } catch (error) {
        logger.error(`Rebuild failed: ${(error as Error).message}`);
      }
    }
  });

  // Watch rules
  const rulesDir = join(projectRoot, emulateOptions.rulesDirectory || 'src/rules');
  if (existsSync(rulesDir)) {
    const rulesWatcher = watch(rulesDir, { recursive: true });
    let lastUpdate = 0;
    const UPDATE_THRESHOLD_MS = 500;

    rulesWatcher.on('change', async (_eventType, filename) => {
      const now = Date.now();
      if (now - lastUpdate < UPDATE_THRESHOLD_MS) return;

      if (
        filename &&
        typeof filename === 'string' &&
        (filename.endsWith('.rules') || filename.endsWith('.json'))
      ) {
        lastUpdate = now;
        logger.info(chalk.dim(`Rule changed: ${basename(filename)}, updating...`));
        try {
          await generateFirebaseJson({ outputDir, emulateOptions, functionFiles });
          logger.info(chalk.green('Rules updated.'));
        } catch (error) {
          logger.error(`Rules update failed: ${(error as Error).message}`);
        }
      }
    });
  }
};

/**
 * Command to run the Firebase emulator with live reload.
 */
export const emulateCommand = new Command('emulate')
  .description('Starts the Firebase emulator with live reload.')
  .option('--mode <mode>', 'The mode to use.')
  .option('--verbose', 'Enable verbose logging.')
  .option('--debug', 'Enable debug mode (keeps temporary files).')
  .option('--silent', 'Disable logging.')
  .option('--minify', 'Will minify the functions.')
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .option('--open', 'Automatically open the Emulator UI in the browser.')
  .option('--watch', 'Enable file watching for live reload.')
  .option('--no-watch', 'Disable file watching.')
  .option('--init', 'Run init script before starting emulators.')
  .option('--no-init', 'Skip running init script.')
  .option('--dry-run', 'Build functions and rules for emulator but do not start it.')
  .option('--force', 'Kill any existing servers running on the emulator ports.')
  .option('--no-force', 'Do not kill existing servers on the emulator ports.')
  .option('--polling', 'Use chokidar polling instead of inotify (bypasses kernel watcher limits).')
  .option('--no-polling', 'Disable polling (force inotify, even if auto-detect would enable it).')
  .option('--emulators <emulators>', 'Comma-separated list of emulators to enable.', (val) =>
    val.split(',')
  )
  .option('--projectId <projectId>', 'The Firebase project ID to emulate.')
  .option(
    '--only <only>',
    'Only start the emulator for specified services (e.g., "functions,firestore").'
  )
  .option('--tsconfig <tsconfig>', 'Path to the tsconfig file to use for the build.')
  .option(
    '--includeFilePath <includeFilePath>',
    'Relative path to a file that will be auto-imported at the top of every generated function index.'
  )
  .action(async (cliOptions: EmulateOptions) => {
    const emulateOptions = await getEmulateOptions(cliOptions);

    if (!emulateOptions.projectId) {
      logger.error(
        chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack config.')
      );
      process.exit(1);
    }

    // Safety net: kill any leftover processes on the known emulator ports.
    const allEmulatorPorts = [
      emulateOptions.emulatorPorts?.ui ?? 4000,
      emulateOptions.emulatorPorts?.functions ?? 5001,
      emulateOptions.emulatorPorts?.firestore ?? 8080,
      emulateOptions.emulatorPorts?.pubsub ?? 8085,
      emulateOptions.emulatorPorts?.auth ?? 9099,
      emulateOptions.emulatorPorts?.storage ?? 9199,
      emulateOptions.emulatorPorts?.database ?? 9000,
      emulateOptions.emulatorPorts?.dataconnect ?? 9399,
      4400,
      4401,
      4500,
      4501,
    ];

    // Generate .env for emulator containing all mode envs (minus service account)
    const env = await getEnvironment(emulateOptions.mode);

    let functionsPath: string | undefined;
    let functionFiles: string[] = [];

    if (emulateOptions.functionsDirectory) {
      functionsPath = join(process.cwd(), emulateOptions.functionsDirectory);
      functionFiles = await findFunctions(functionsPath);

      if (functionFiles.length === 0) {
        logger.info(chalk.yellow('⚠️  No functions found to emulate.'));
      } else {
        logger.info(chalk.dim(`Found ${functionFiles.length} functions to build.`));
      }
    }

    const outputDir = join(process.cwd(), 'dist', 'emulator');
    await mkdir(outputDir, { recursive: true });

    if (functionFiles.length > 0 && functionsPath) {
      logger.info(chalk.cyan('🛠️  Building functions for emulator...'));
      await buildEmulatorFunctions({
        functionFiles,
        outputDir,
        emulateOptions,
        controllersPath: functionsPath,
        env,
      });
      logger.info(chalk.green('✅ Build complete.'));
    }

    await generateFirebaseJson({ outputDir, emulateOptions, functionFiles });

    if (emulateOptions.force) {
      await forceCleanupEmulators(allEmulatorPorts, emulateOptions.projectId);
    } else {
      logger.debug('No processes found on emulator ports');
    }

    if (cliOptions.dryRun) {
      console.log('Emulator dry run complete');
      logger.info(chalk.bold.green('✨ Emulator dry run complete.'));
      return;
    }

    const commandArgs = ['emulators:start', '--project', emulateOptions.projectId];
    if (emulateOptions.only) {
      commandArgs.push('--only', emulateOptions.only);
    }

    logger.info(chalk.bold.green('🔥 Starting Firebase emulator...'));

    // Resolve chokidar polling mode (auto-detect or explicit)
    const polling = resolveChokidarPolling(emulateOptions.polling ?? 'auto');
    if (polling.warning) {
      logger.warn(chalk.yellow(`⚠️  ${polling.warning}`));
    } else if (polling.enabled) {
      logger.info(chalk.cyan('🔁 Chokidar polling enabled (bypasses inotify limits).'));
    }

    let uiLogged = false;
    let emulatorSubprocess: Subprocess | undefined;

    const cleanupOnExit = () => {
      if (emulatorSubprocess && !emulatorSubprocess.killed) {
        const pid = emulatorSubprocess.pid;
        if (pid !== undefined) {
          try {
            // Kill the entire process group so grandchildren (Java emulators) also stop.
            process.kill(-pid, 'SIGTERM');
          } catch {
            emulatorSubprocess.kill('SIGTERM');
          }
        } else {
          emulatorSubprocess.kill('SIGTERM');
        }
      }

      // Fire-and-forget with a timeout so we always exit within 2s
      void forceCleanupEmulators(allEmulatorPorts, emulateOptions.projectId).finally(() => exit(0));
      setTimeout(() => exit(0), 2000);
    };

    process.on('SIGINT', cleanupOnExit);
    process.on('SIGTERM', cleanupOnExit);
    process.on('SIGHUP', cleanupOnExit);

    const emulatorProcess = executeCommand('firebase', {
      args: commandArgs,
      cwd: outputDir,
      packageManager: emulateOptions.packageManager,
      env: {
        ...process.env,
        ...(polling.enabled ? { CHOKIDAR_USEPOLLING: 'true' } : {}),
        JAVA_OPTS:
          '-XX:+IgnoreUnrecognizedVMOptions --add-opens=java.base/java.nio=ALL-UNNAMED --add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
      },
      onSubprocess: (subprocess) => {
        emulatorSubprocess = subprocess;
      },
      onStdout: (data) => {
        if (!uiLogged && data.includes('Emulator UI at')) {
          const match = data.match(/http:\/\/[^\s/]+/);
          if (match) {
            const url = `${match[0]}/`;
            logger.info(chalk.bold.cyan(`\n👉 Emulator UI: ${url}\n`));
            uiLogged = true;

            // Trigger open and init when UI is ready
            if (cliOptions.open) {
              openUrl(url).catch((err) => {
                logger.debug(`Failed to auto-open URL: ${err.message}`);
              });
            }

            if (cliOptions.init !== false) {
              // Give it a tiny bit more time for the services to be fully bound
              setTimeout(
                () =>
                  runOnEmulate({
                    ...emulateOptions,
                    env,
                  }),
                1000
              );
            }
          }
        }
      },
    });

    emulatorProcess.then((result) => {
      if (!result.success) {
        logger.error(chalk.red('❌ Emulator failed to start or exited with an error.'));
        exit(result.code || 1);
      }
      logger.info(chalk.green('👋 Emulator stopped.'));
    });

    if (cliOptions.watch !== false && functionFiles.length > 0 && functionsPath) {
      watchAndRebuild({
        functionsPath,
        functionFiles,
        outputDir,
        emulateOptions,
        controllersPath: functionsPath,
        env,
      });
    }

    await emulatorProcess;
  });
