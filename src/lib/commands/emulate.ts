import { existsSync, watch } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import { buildFunction } from '$utils/build_utils.ts';
import { executeCommand } from '$utils/command.ts';
import { exists, findProjectRoot, openUrl } from '$utils/common.ts';
import { createPackageJson, toDotEnvironmentCode } from '$utils/firebase_utils.ts';
import { createTemporaryIndexFunctionFile } from './deploy/utils/create_deploy_index.ts';
import { getEnvironment } from './deploy/utils/environment.ts';
import { findFunctions } from './deploy/utils/find_functions.ts';
import { type DeployOptions, getDeployOptions } from './deploy/utils/options.ts';
import { parseFunctionMetadata } from './deploy/utils/parse_function_metadata.ts';

type EmulateOptions = DeployOptions & {
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  emulators?: string[];
  dryRun?: boolean;
};

/**
 * Runs the initialization script for the emulator.
 */
const runOnEmulate = async (options: EmulateOptions) => {
  const scriptsDir = options.scriptsDirectory || 'scripts';
  const initScript = options.initScript || 'on_emulate.ts';
  const initScriptPath = join(process.cwd(), scriptsDir, initScript);

  if (!(await exists(initScriptPath))) {
    logger.debug(chalk.dim(`No init script found at ${initScriptPath}`));
    return;
  }

  // Pass emulator environment variables
  const emulatorEnv = {
    FIREBASE_PROJECT_ID: options.projectId || 'demo-project',
    GCLOUD_PROJECT: options.projectId || 'demo-project',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
  };

  logger.info(chalk.cyan(`🏃 Running init script: ${chalk.bold(initScript)}`));

  try {
    await executeCommand('bun', {
      args: [initScriptPath],
      env: { ...process.env, ...emulatorEnv },
    });
    logger.info(chalk.green('✅ Init script completed.'));
  } catch (error) {
    logger.error(chalk.red(`❌ Init script failed: ${(error as Error).message}`));
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
}): Promise<void> => {
  const { functionFiles, outputDir, emulateOptions, controllersPath } = options;
  const projectRoot = await findProjectRoot();
  const tempDir = join(process.cwd(), 'tmp', 'emulator');

  await Promise.all([
    mkdir(tempDir, { recursive: true }),
    mkdir(join(outputDir, 'src'), { recursive: true }),
  ]);

  const exports: string[] = [];

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

  for (const metadata of functionMetadataList) {
    if (!metadata) continue;

    const { functionPath, firestackOptions, functionOptions, deployFunction } = metadata;
    const functionName = firestackOptions.functionName || 'function';

    const generatedFile = await createTemporaryIndexFunctionFile({
      functionPath,
      functionName,
      temporaryDirectory: tempDir,
      functionsDirectoryPath: controllersPath,
      deployFunction,
      functionOptions,
    });

    if (generatedFile) {
      const relativePath = relative(tempDir, generatedFile).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
      exports.push(`export { ${functionName} } from '${importPath.replace(/\.ts$/, '')}';`);
    }
  }

  const combinedIndexContent = `${exports.join('\n')}\n`;
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
  });

  const packageJson = await createPackageJson({
    nodeVersion: emulateOptions.nodeVersion,
    functionName: 'emulator',
    isEmulator: true,
  });

  await writeFile(join(outputDir, 'src', 'package.json'), packageJson);

  // Generate .env for emulator containing all flavor envs (minus service account)
  const env = await getEnvironment(emulateOptions.flavor);
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

  if (emulateOptions.emulators) {
    for (const e of emulateOptions.emulators) emulatorsToEnable.add(e);
  } else {
    emulatorsToEnable.add('auth');
    if (functionFiles.length > 0) {
      emulatorsToEnable.add('functions');
      emulatorsToEnable.add('firestore');
      if (await checkHasScheduler(functionFiles)) {
        emulatorsToEnable.add('pubsub');
      }
    }
    if (await hasRuleFile(emulateOptions, 'firestore')) emulatorsToEnable.add('firestore');
    if (await hasRuleFile(emulateOptions, 'storage')) emulatorsToEnable.add('storage');
  }

  const firebaseConfig: Record<string, unknown> = {
    functions: [
      {
        source: 'src', // Relative to firebase.json in dist/emulator
        codebase: 'default',
        runtime: `nodejs${emulateOptions.nodeVersion}`,
      },
    ],
    emulators: {
      singleProjectMode: true,
      ui: { enabled: true, port: 4000 },
    },
  };

  const emulators = firebaseConfig.emulators as Record<string, unknown>;

  if (emulatorsToEnable.has('auth')) emulators.auth = { port: 9099 };
  if (emulatorsToEnable.has('functions')) emulators.functions = { port: 5001 };
  if (emulatorsToEnable.has('firestore')) emulators.firestore = { port: 8080 };
  if (emulatorsToEnable.has('pubsub')) emulators.pubsub = { port: 8085 };
  if (emulatorsToEnable.has('storage')) emulators.storage = { port: 9199 };
  if (emulatorsToEnable.has('database')) emulators.database = { port: 9000 };
  if (emulatorsToEnable.has('hosting')) emulators.hosting = { port: 5000 };

  // 2. Rules and Indexes Handling
  await copyRulesAndIndexes({ outputDir, emulateOptions, firebaseConfig });

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
 * Watches for file changes and rebuilds.
 */
const watchAndRebuild = (options: {
  functionsPath: string;
  functionFiles: string[];
  outputDir: string;
  emulateOptions: EmulateOptions;
  controllersPath: string;
}): void => {
  const { functionsPath, functionFiles, outputDir, emulateOptions, controllersPath } = options;
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
        await buildEmulatorFunctions({ functionFiles, outputDir, emulateOptions, controllersPath });
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
  .option('--flavor <flavor>', 'The flavor to use.')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .option('--open', 'Automatically open the Emulator UI in the browser.')
  .option('--watch', 'Enable file watching for live reload.', true)
  .option('--no-watch', 'Disable file watching.')
  .option('--init', 'Run init script before starting emulators.', true)
  .option('--no-init', 'Skip running init script.')
  .option('--dry-run', 'Build functions and rules for emulator but do not start it.')
  .option('--emulators <emulators>', 'Comma-separated list of emulators to enable.', (val) =>
    val.split(',')
  )
  .option('--projectId <projectId>', 'The Firebase project ID to emulate.')
  .option(
    '--only <only>',
    'Only start the emulator for specified services (e.g., "functions,firestore").'
  )
  .action(async (cliOptions: EmulateOptions) => {
    const emulateOptions = await getDeployOptions(cliOptions);

    if (!emulateOptions.projectId) {
      logger.error(
        chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
      );
      process.exit(1);
    }

    if (!emulateOptions.functionsDirectory) {
      throw new Error('Functions directory is required for emulation.');
    }

    const functionsPath = join(process.cwd(), emulateOptions.functionsDirectory);
    const functionFiles = await findFunctions(functionsPath);

    if (functionFiles.length === 0) {
      logger.warn(chalk.yellow('⚠️  No functions found to emulate.'));
      return;
    }

    logger.info(chalk.dim(`Found ${functionFiles.length} functions to build.`));

    const outputDir = join(process.cwd(), 'dist', 'emulator');
    await mkdir(outputDir, { recursive: true });

    logger.info(chalk.cyan('🛠️  Building functions for emulator...'));
    await buildEmulatorFunctions({
      functionFiles,
      outputDir,
      emulateOptions,
      controllersPath: functionsPath,
    });
    logger.info(chalk.green('✅ Build complete.'));

    await generateFirebaseJson({ outputDir, emulateOptions, functionFiles });

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

    let uiLogged = false;

    const emulatorProcess = executeCommand('firebase', {
      args: commandArgs,
      cwd: outputDir,
      packageManager: emulateOptions.packageManager,
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
              setTimeout(() => runOnEmulate(emulateOptions), 1000);
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

    if (cliOptions.watch !== false) {
      watchAndRebuild({
        functionsPath,
        functionFiles,
        outputDir,
        emulateOptions,
        controllersPath: functionsPath,
      });
    }

    await emulatorProcess;
  });
