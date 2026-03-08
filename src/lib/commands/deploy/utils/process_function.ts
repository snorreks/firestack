import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { cwd } from 'node:process';
import chalk from 'chalk';
import { logger } from '$logger';
import type { ChecksumData, NodeVersion } from '$types';
import { buildFunction } from '$utils/build_utils.js';
import { cacheChecksumLocal, checkForChanges } from '$utils/checksum.js';
import { executeCommand } from '$utils/command.js';
import { findProjectRoot } from '$utils/common.js';
import {
  createFirebaseConfig,
  createPackageJson,
  toDotEnvironmentCode,
} from '$utils/firebase_utils.js';
import { deriveFunctionName } from '$utils/function_naming.js';
import { getEnvironmentNeeded } from '$utils/read-compiled-file.js';
import { createTemporaryIndexFunctionFile } from './create_deploy_index.js';
import type { DeployOptions } from './options.js';

export interface ProcessResult {
  functionName: string;
  status: 'deployed' | 'skipped' | 'failed' | 'dry-run';
}

export interface PrepareResult {
  functionName: string;
  status: 'to-deploy' | 'skipped' | 'failed' | 'dry-run';
  deployFunctionData?: ChecksumData;
  outputDir?: string;
  temporaryDir?: string;
}

export interface ProcessFunctionOptions {
  funcPath: string;
  options: DeployOptions;
  environment: Record<string, string>;
  controllersPath: string;
}

/**
 * Phase 1: Planning.
 * Builds the function and checks for changes.
 */
export async function prepareFunction(opts: ProcessFunctionOptions): Promise<PrepareResult> {
  const { funcPath, environment, controllersPath } = opts;
  const options = { ...opts.options }; // Clone options to avoid concurrent modification
  const functionName = deriveFunctionName({ funcPath, controllersPath });

  // Downgrade Node version for Auth triggers (GCF 1st Gen doesn't support Node 24)
  const relativePath = relative(controllersPath, funcPath).replace(/\\/g, '/');
  const isAuthTrigger = relativePath.startsWith('auth/');

  if (isAuthTrigger && options.nodeVersion === '24') {
    logger.warn(
      chalk.yellow(
        `⚠️  Function '${functionName}' is an Auth trigger (GCF 1st Gen), which does not support Node.js 24. Downgrading to Node.js 22.`
      )
    );
    options.nodeVersion = '22';
  }

  const outputDir = join(cwd(), 'dist', functionName);
  const temporaryDir = join(cwd(), 'tmp', functionName);

  try {
    if (!options.nodeVersion) {
      throw new Error('Node version is required for deployment.');
    }

    // 1. Setup
    await setupDirectories({ outputDir, temporaryDir, options, functionName });

    // 2. Build
    const buildSuccess = await performBuild({
      funcPath,
      functionName,
      outputDir,
      temporaryDir,
      controllersPath,
      options,
    });
    if (!buildSuccess) return { functionName, status: 'failed' };

    // 3. Env
    const envNeeded = await setupEnvironment({ outputDir, environment });

    // 4. Check changes
    const deployFunctionData = await checkForChanges({
      functionName,
      outputRoot: outputDir,
      flavor: options.flavor,
      force: options.force,
      outputDirectory: join(cwd(), 'dist'),
      environment: envNeeded,
    });

    if (!deployFunctionData) {
      // Cleanup early if skipped
      if (!options.debug) {
        await rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
      }
      return { functionName, status: 'skipped' };
    }

    if (options.dryRun) {
      return { functionName, status: 'dry-run', deployFunctionData, outputDir, temporaryDir };
    }

    return { functionName, status: 'to-deploy', deployFunctionData, outputDir, temporaryDir };
  } catch (error) {
    logger.error(`❌ Failed to prepare ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  }
}

interface ExecuteDeploymentActionOptions {
  prepareResult: PrepareResult;
  options: DeployOptions;
}

/**
 * Phase 2: Execution.
 * Installs dependencies and deploys to Firebase.
 */
export async function executeFunctionDeployment(
  opts: ExecuteDeploymentActionOptions
): Promise<ProcessResult> {
  const { prepareResult, options } = opts;
  const { functionName, outputDir, temporaryDir, deployFunctionData } = prepareResult;

  if (!outputDir || !deployFunctionData) {
    return { functionName, status: 'failed' };
  }

  try {
    // 1. Dependencies
    const installSuccess = await installDependencies({ outputDir, options });
    if (!installSuccess) return { functionName, status: 'failed' };

    // 2. Deploy
    const deploySuccess = await deployAction({ functionName, outputDir, options });
    if (!deploySuccess) return { functionName, status: 'failed' };

    // 3. Cache
    await cacheChecksumLocal(deployFunctionData);
    return { functionName, status: 'deployed' };
  } catch (error) {
    logger.error(`❌ Failed to deploy ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  } finally {
    if (!options.debug && temporaryDir) {
      await rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

interface SetupDirectoriesOptions {
  outputDir: string;
  temporaryDir: string;
  options: DeployOptions;
  functionName: string;
}

async function setupDirectories(opts: SetupDirectoriesOptions) {
  const { outputDir, temporaryDir, options, functionName } = opts;
  const { nodeVersion } = options;
  if (!nodeVersion) throw new Error('Node version is required.');

  await Promise.all([
    rm(outputDir, { recursive: true, force: true }),
    rm(temporaryDir, { recursive: true, force: true }),
  ]);

  await Promise.all([
    mkdir(join(outputDir, 'src'), { recursive: true }),
    mkdir(temporaryDir, { recursive: true }),
  ]);

  const [firebaseConfig, packageJson] = await Promise.all([
    Promise.resolve(createFirebaseConfig({ nodeVersion, functionName })),
    createPackageJson({
      nodeVersion,
      external: options.external,
      functionName,
      isEmulator: options.isEmulator,
    }),
  ]);

  await Promise.all([
    writeFile(join(outputDir, 'firebase.json'), firebaseConfig, 'utf-8'),
    writeFile(join(outputDir, 'src', 'package.json'), packageJson, 'utf-8'),
  ]);
}

interface PerformBuildOptions {
  funcPath: string;
  functionName: string;
  outputDir: string;
  temporaryDir: string;
  controllersPath: string;
  options: DeployOptions;
}

async function performBuild(opts: PerformBuildOptions): Promise<boolean> {
  const { funcPath, functionName, outputDir, temporaryDir, controllersPath, options } = opts;
  const outputFile = join(outputDir, 'src', 'index.js');

  try {
    const inputFile = await createTemporaryIndexFunctionFile({
      funcPath,
      functionName,
      temporaryDirectory: temporaryDir,
      controllersPath,
      region: options.region,
    });

    const projectRoot = await findProjectRoot();
    await buildFunction({
      inputFile,
      outputFile,
      configPath: join(projectRoot, 'package.json'),
      minify: options.minify,
      sourcemap: options.sourcemap,
      external: options.external,
      nodeVersion: options.nodeVersion as NodeVersion,
      keepNames: true,
    });
    return true;
  } catch (buildError) {
    logger.error(`Failed to build ${functionName}: ${(buildError as Error).message}`);
    return false;
  }
}

interface SetupEnvironmentOptions {
  outputDir: string;
  environment: Record<string, string>;
}

async function setupEnvironment(opts: SetupEnvironmentOptions) {
  const { outputDir, environment } = opts;
  const envNeeded = await getEnvironmentNeeded({ outputDir, environment });
  logger.debug(`Environment needed for ${outputDir}:`, envNeeded);
  if (envNeeded) {
    const envCode = toDotEnvironmentCode({ env: envNeeded });
    await writeFile(join(outputDir, '.env'), envCode, 'utf-8');
  }
  return envNeeded;
}

interface InstallDependenciesOptions {
  outputDir: string;
  options: DeployOptions;
}

async function installDependencies(opts: InstallDependenciesOptions): Promise<boolean> {
  const { outputDir, options } = opts;
  if (!options.external || options.external.length === 0) return true;

  const result = await executeCommand('npm', {
    args: ['install'],
    cwd: join(outputDir, 'src'),
    packageManager: 'global',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (!result.success) {
    logger.error(`Failed to install dependencies for ${outputDir}:`);
    logger.error(result.stderr);
    return false;
  }
  return true;
}

interface DeployActionOptions {
  functionName: string;
  outputDir: string;
  options: DeployOptions;
}

async function deployAction(opts: DeployActionOptions): Promise<boolean> {
  const { functionName, outputDir, options } = opts;
  if (!options.projectId) throw new Error('Project ID is required.');

  const deployArgs = [
    'deploy',
    '--config',
    'firebase.json',
    '--only',
    `functions:${functionName}`,
    '--project',
    options.projectId,
  ];
  if (options.force) deployArgs.push('--force');

  try {
    const result = await executeCommand('firebase', {
      args: deployArgs,
      cwd: outputDir,
      packageManager: options.packageManager,
    });

    if (result.success) {
      logger.info(chalk.dim(`Successfully deployed ${functionName}.`));
      return true;
    }

    logger.error(`❌ Failed to deploy ${functionName}.`);
    if (result.stderr) logger.error(chalk.red(result.stderr));
    if (result.stdout && !options.verbose) logger.error(chalk.dim(result.stdout));
    return false;
  } catch (deployError) {
    logger.error(`Failed to deploy ${functionName}: ${(deployError as Error).message}`);
    return false;
  }
}
