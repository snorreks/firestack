import { existsSync, watch } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { DEFAULT_NODE_VERSION } from '$constants';
import { logger } from '$logger';
import type { NodeVersion } from '$types';
import { buildFunction } from '$utils/build_utils.js';
import { executeCommand } from '$utils/command.js';
import { exists, findProjectRoot, openUrl } from '$utils/common.js';
import { createPackageJson, toDotEnvironmentCode } from '$utils/firebase_utils.js';
import { deriveFunctionName } from '$utils/function_naming.js';
import { createTemporaryIndexFunctionFile } from './deploy/utils/create_deploy_index.js';
import { getEnvironment } from './deploy/utils/environment.js';
import { findFunctions } from './deploy/utils/find_functions.js';
import { type DeployOptions, getDeployOptions } from './deploy/utils/options.js';

interface EmulateOptions extends DeployOptions {
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  emulators?: string[];
}

/**
 * Runs the initialization script for the emulator.
 */
async function runOnEmulate(options: EmulateOptions) {
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
}

/**
 * Builds all functions into a combined index.js for the emulator.
 */
async function buildEmulatorFunctions(opts: {
  functionFiles: string[];
  outputDir: string;
  options: EmulateOptions;
  controllersPath: string;
}): Promise<void> {
  const { functionFiles, outputDir, options, controllersPath } = opts;
  const projectRoot = await findProjectRoot();
  const tempDir = join(process.cwd(), 'tmp', 'emulator');

  await Promise.all([
    mkdir(tempDir, { recursive: true }),
    mkdir(join(outputDir, 'src'), { recursive: true }),
  ]);

  const exports: string[] = [];

  for (const funcFile of functionFiles) {
    const funcName = deriveFunctionName({ funcPath: funcFile, controllersPath });

    const generatedFile = await createTemporaryIndexFunctionFile({
      funcPath: funcFile,
      functionName: funcName,
      temporaryDirectory: tempDir,
      controllersPath,
    });

    if (generatedFile !== funcFile) {
      const relativePath = relative(tempDir, generatedFile).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
      exports.push(`export * from '${importPath}';`);
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
    minify: options.minify ?? false,
    sourcemap: options.sourcemap ?? true,
    nodeVersion: options.nodeVersion as NodeVersion,
  });

  const packageJson = await createPackageJson({
    nodeVersion: options.nodeVersion || DEFAULT_NODE_VERSION,
    functionName: 'emulator',
    isEmulator: true,
  });

  await writeFile(join(outputDir, 'src', 'package.json'), packageJson);

  // Generate .env for emulator containing all flavor envs (minus service account)
  const env = await getEnvironment(options.flavor);
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

  if (!options.debug) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Generates firebase.json for the emulator inside the output directory.
 * Also copies rules and index files to the output directory.
 */
async function generateFirebaseJson(opts: {
  outputDir: string;
  options: EmulateOptions;
  functionFiles: string[];
}): Promise<void> {
  const { outputDir, options, functionFiles } = opts;

  // 1. Collect potential emulators to enable
  const emulatorsToEnable = new Set<string>();

  if (options.emulators) {
    for (const e of options.emulators) emulatorsToEnable.add(e);
  } else {
    emulatorsToEnable.add('auth');
    if (functionFiles.length > 0) {
      emulatorsToEnable.add('functions');
      emulatorsToEnable.add('firestore');
      if (await checkHasScheduler(functionFiles)) {
        emulatorsToEnable.add('pubsub');
      }
    }
    if (await hasRuleFile(options, 'firestore')) emulatorsToEnable.add('firestore');
    if (await hasRuleFile(options, 'storage')) emulatorsToEnable.add('storage');
  }

  const firebaseConfig: Record<string, unknown> = {
    functions: [
      {
        source: 'src', // Relative to firebase.json in dist/emulator
        codebase: 'default',
        runtime: `nodejs${options.nodeVersion || DEFAULT_NODE_VERSION}`,
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
  await copyRulesAndIndexes({ outputDir, options, firebaseConfig });

  await writeFile(join(outputDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));
}

/**
 * Copies rules and index files to the emulator directory and updates the config.
 */
async function copyRulesAndIndexes(opts: {
  outputDir: string;
  options: EmulateOptions;
  firebaseConfig: Record<string, unknown>;
}) {
  const { outputDir, options, firebaseConfig } = opts;
  const projectRoot = process.cwd();

  // Helper to find and copy a file
  const findAndCopy = async (filename: string, configPath: string[]) => {
    const searchPaths = [
      join(projectRoot, filename),
      join(projectRoot, options.rulesDirectory || 'src/rules', filename),
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
}

async function checkHasScheduler(functionFiles: string[]): Promise<boolean> {
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
}

async function hasRuleFile(
  options: EmulateOptions,
  type: 'firestore' | 'storage'
): Promise<boolean> {
  const filename = `${type}.rules`;
  const paths = [
    join(process.cwd(), filename),
    join(process.cwd(), options.rulesDirectory || 'src/rules', filename),
  ];
  const results = await Promise.all(paths.map((p) => exists(p)));
  return results.some((r) => r);
}

/**
 * Watches for file changes and rebuilds.
 */
function watchAndRebuild(opts: {
  functionsPath: string;
  functionFiles: string[];
  outputDir: string;
  options: EmulateOptions;
  controllersPath: string;
}): void {
  const { functionsPath, functionFiles, outputDir, options, controllersPath } = opts;
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
        await buildEmulatorFunctions({ functionFiles, outputDir, options, controllersPath });
        logger.info(chalk.green('Rebuild complete.'));
      } catch (error) {
        logger.error(`Rebuild failed: ${(error as Error).message}`);
      }
    }
  });

  // Watch rules
  const rulesDir = join(projectRoot, options.rulesDirectory || 'src/rules');
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
          await generateFirebaseJson({ outputDir, options, functionFiles });
          logger.info(chalk.green('Rules updated.'));
        } catch (error) {
          logger.error(`Rules update failed: ${(error as Error).message}`);
        }
      }
    });
  }
}

/**
 * Command to run the Firebase emulator with live reload.
 */
export const emulateCommand = new Command('emulate')
  .description('Starts the Firebase emulator with live reload.')
  .option('--flavor <flavor>', 'The flavor to use.', 'development')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .option('--open', 'Automatically open the Emulator UI in the browser.')
  .option('--watch', 'Enable file watching for live reload.', true)
  .option('--no-watch', 'Disable file watching.')
  .option('--init', 'Run init script before starting emulators.', true)
  .option('--no-init', 'Skip running init script.')
  .option('--emulators <emulators>', 'Comma-separated list of emulators to enable.', (val) =>
    val.split(',')
  )
  .option('--projectId <projectId>', 'The Firebase project ID to emulate.')
  .option(
    '--only <only>',
    'Only start the emulator for specified services (e.g., "functions,firestore").'
  )
  .action(async (cliOptions: EmulateOptions) => {
    const options = await getDeployOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        chalk.red('❌ Project ID not found. Provide it with --projectId or in firestack.json.')
      );
      process.exit(1);
    }

    if (!options.functionsDirectory) {
      throw new Error('Functions directory is required for emulation.');
    }

    const functionsPath = join(process.cwd(), options.functionsDirectory);
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
      options,
      controllersPath: functionsPath,
    });
    logger.info(chalk.green('✅ Build complete.'));

    await generateFirebaseJson({ outputDir, options, functionFiles });

    const commandArgs = ['emulators:start', '--project', options.projectId];
    if (cliOptions.only) {
      commandArgs.push('--only', cliOptions.only);
    }

    logger.info(chalk.bold.green('🔥 Starting Firebase emulator...'));

    let uiLogged = false;

    const emulatorProcess = executeCommand('firebase', {
      args: commandArgs,
      cwd: outputDir,
      packageManager: options.packageManager,
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
              setTimeout(() => runOnEmulate(options), 1000);
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
        options,
        controllersPath: functionsPath,
      });
    }

    await emulatorProcess;
  });
