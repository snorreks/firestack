import { existsSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { Command } from 'commander';
import { execa } from 'execa';
import { buildFunction } from '../utils/build_utils.js';
import { findProjectRoot } from '../utils/common.js';
import { DEFAULT_NODE_VERSION } from '../utils/constants.js';
import { deriveFunctionName } from '../utils/function_naming.js';
import { logger } from '../utils/logger.js';
import { createTemporaryIndexFunctionFile } from './deploy/utils/create_deploy_index.js';
import { findFunctions } from './deploy/utils/find_functions.js';
import { type DeployOptions, getOptions } from './deploy/utils/options.js';

interface EmulateOptions extends DeployOptions {
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  watch?: boolean;
  init?: boolean;
}

/**
 * Runs the init script before starting emulators.
 */
async function runInitScript(
  scriptsDirectory: string,
  initScript: string,
  projectId: string
): Promise<void> {
  const initScriptPath = join(process.cwd(), scriptsDirectory, initScript);

  if (!existsSync(initScriptPath)) {
    logger.info(`Init script not found at ${initScriptPath}, skipping.`);
    return;
  }

  logger.info(`Running init script: ${initScript}`);

  try {
    await execa('bun', ['run', initScriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: projectId,
        GCLOUD_PROJECT: projectId,
      },
      stdio: 'inherit',
    });
    logger.info('Init script completed successfully.');
  } catch (error) {
    logger.error(`Failed to run init script: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Builds all functions into a combined index.js for the emulator.
 */
async function buildEmulatorFunctions(
  functionFiles: string[],
  outputDir: string,
  options: EmulateOptions,
  controllersPath: string
): Promise<void> {
  const projectRoot = await findProjectRoot();
  const tempDir = join(process.cwd(), 'tmp', 'emulator');
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(outputDir, 'src'), { recursive: true });

  const exports: string[] = [];

  for (const funcFile of functionFiles) {
    const funcName = deriveFunctionName(funcFile, controllersPath);

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

  logger.debug('Generated combined index file:', combinedIndexContent);

  await buildFunction({
    inputFile: tempIndexPath,
    outputFile: join(outputDir, 'src', 'index.js'),
    configPath: join(projectRoot, 'package.json'),
    minify: options.minify,
    sourcemap: options.sourcemap,
  });

  const packageJson = {
    name: 'functions',
    type: 'module',
    main: 'index.js',
    engines: { node: `${options.nodeVersion || DEFAULT_NODE_VERSION}` },
  };
  await writeFile(join(outputDir, 'src', 'package.json'), JSON.stringify(packageJson, null, 2));

  logger.info('Installing dependencies...');
  try {
    await execa('npm', ['install'], {
      cwd: join(outputDir, 'src'),
      stdio: 'inherit',
    });
  } catch (_error) {
    throw new Error('Failed to install dependencies');
  }
  logger.info('Dependencies installed.');

  if (!options.debug) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Generates firebase.json for the emulator.
 */
async function generateFirebaseJson(outputDir: string, options: EmulateOptions): Promise<void> {
  const firebaseConfig: Record<string, unknown> = {
    functions: [
      {
        source: 'src',
        codebase: 'default',
        runtime: `nodejs${options.nodeVersion || DEFAULT_NODE_VERSION}`,
      },
    ],
    emulators: {
      functions: { port: 5001 },
      firestore: { port: 8080 },
      ui: { enabled: true, port: 4000 },
      singleProjectMode: true,
    },
  };

  if (options.firestoreRules && existsSync(options.firestoreRules)) {
    firebaseConfig.firestore = {
      rules: options.firestoreRules,
    };
  }

  if (options.storageRules && existsSync(options.storageRules)) {
    firebaseConfig.storage = {
      rules: options.storageRules,
    };
  }

  await writeFile(join(outputDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2));
}

/**
 * Watches for file changes and rebuilds.
 */
async function watchAndRebuild(
  functionsPath: string,
  functionFiles: string[],
  outputDir: string,
  options: EmulateOptions,
  controllersPath: string
): Promise<void> {
  logger.info('Watching for file changes...');

  const watcher = watch(functionsPath, { recursive: true });

  watcher.on('change', async (_eventType, filename) => {
    if (
      filename &&
      typeof filename === 'string' &&
      (filename.endsWith('.ts') || filename.endsWith('.tsx'))
    ) {
      logger.info(`File changed: ${basename(filename)}, rebuilding...`);
      try {
        await buildEmulatorFunctions(functionFiles, outputDir, options, controllersPath);
        logger.info('Rebuild complete.');
      } catch (error) {
        logger.error(`Rebuild failed: ${(error as Error).message}`);
      }
    }
  });
}

export const emulateCommand = new Command('emulate')
  .description('Starts the Firebase emulator with live reload.')
  .option('--flavor <flavor>', 'The flavor to use for emulation.', 'development')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--debug', 'Enable debug mode (keeps temporary files).')
  .option('--projectId <projectId>', 'The Firebase project ID to emulate.')
  .option(
    '--only <only>',
    'Only start the emulator for the given services (e.g., "functions,firestore").',
    'functions,firestore'
  )
  .option(
    '--firestoreRules <firestoreRules>',
    'Path to the Firestore rules file.',
    'firestore.rules'
  )
  .option('--storageRules <storageRules>', 'Path to the Storage rules file.', 'storage.rules')
  .option('--watch', 'Enable file watching for live reload.', true)
  .option('--no-watch', 'Disable file watching.')
  .option('--init', 'Run init script before starting emulators.', true)
  .option('--no-init', 'Skip running init script.')
  .option('--minify', 'Will minify the functions.', false)
  .option('--no-minify', 'Do not minify the functions.')
  .option('--sourcemap', 'Whether to generate sourcemaps.', true)
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .option(
    '--functionsDirectory <functionsDirectory>',
    'The directory where the functions are located.'
  )
  .option('--node-version <nodeVersion>', 'The Node.js version to use for the functions.')
  .action(async (cliOptions: EmulateOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      process.exit(1);
    }

    // Run init script if enabled
    if (cliOptions.init !== false) {
      try {
        await runInitScript(
          options.scriptsDirectory || 'scripts',
          options.initScript || 'init.ts',
          options.projectId
        );
      } catch (_error) {
        logger.error('Failed to run init script, continuing without initialization...');
      }
    }

    const functionsPath = join(process.cwd(), options.functionsDirectory!);
    const functionFiles = await findFunctions(functionsPath);

    if (functionFiles.length === 0) {
      logger.warn('No functions found to emulate.');
      return;
    }

    logger.info(`Found ${functionFiles.length} functions to build.`);

    const outputDir = join(process.cwd(), 'dist', 'emulator');
    await mkdir(outputDir, { recursive: true });

    logger.info('Building functions for emulator...');
    await buildEmulatorFunctions(functionFiles, outputDir, options, functionsPath);
    logger.info('Build complete.');

    await generateFirebaseJson(outputDir, options);

    const commandArgs = ['emulators:start', '--project', options.projectId!];
    if (cliOptions.only) {
      commandArgs.push('--only', cliOptions.only);
    }

    logger.info('Starting Firebase emulator...');
    logger.debug(`> firebase ${commandArgs.join(' ')}`);

    const emulatorProcess = execa('firebase', commandArgs, {
      cwd: outputDir,
      stdio: 'inherit',
    });

    if (cliOptions.watch) {
      watchAndRebuild(functionsPath, functionFiles, outputDir, options, functionsPath);
    }

    await emulatorProcess;
  });
