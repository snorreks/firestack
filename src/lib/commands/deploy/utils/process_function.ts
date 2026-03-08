import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { cwd } from 'node:process';
import chalk from 'chalk';
import { logger } from '$logger';
import type { ChecksumData, FirestackOptions, FunctionOptions, NodeVersion } from '$types';
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

export type ProcessResult = {
  functionName: string;
  status: 'deployed' | 'skipped' | 'failed' | 'dry-run';
};

export type PrepareResult = {
  functionName: string;
  status: 'to-deploy' | 'skipped' | 'failed' | 'dry-run';
  deployFunctionData?: ChecksumData;
  outputDir?: string;
  temporaryDir?: string;
};

/**
 * Phase 1: Planning.
 * Builds the function and checks for changes.
 */
export const prepareFunction = async (options: {
  functionPath: string;
  deployOptions: DeployOptions;
  environment: Record<string, string>;
  functionsDirectoryPath: string;
  functionName?: string;
}): Promise<PrepareResult> => {
  const {
    deployOptions,
    functionPath,
    environment,
    functionsDirectoryPath,
    functionName: overrideFunctionName,
  } = options;

  // Use override functionName if provided, otherwise derive from path
  const functionName = overrideFunctionName ?? deriveFunctionName(options);

  // Downgrade Node version for Auth triggers (GCF 1st Gen doesn't support Node 24)
  const relativePath = relative(functionsDirectoryPath, functionPath).replace(/\\/g, '/');
  const isAuthTrigger = relativePath.startsWith('auth/');

  if (isAuthTrigger && deployOptions.nodeVersion === '24') {
    logger.warn(
      chalk.yellow(
        `⚠️  Function '${functionName}' is an Auth trigger (GCF 1st Gen), which does not support Node.js 24. Downgrading to Node.js 22.`
      )
    );
    deployOptions.nodeVersion = '22';
  }

  const outputDir = join(cwd(), 'dist', functionName);
  const temporaryDir = join(cwd(), 'tmp', functionName);

  try {
    if (!deployOptions.nodeVersion) {
      throw new Error('Node version is required for deployment.');
    }

    // 1. Setup
    await setupDirectories({ outputDir, temporaryDir, deployOptions, functionName });

    // 2. Build
    const buildSuccess = await performBuild({
      functionPath,
      functionName,
      outputDir,
      temporaryDir,
      functionsDirectoryPath,
      deployOptions,
    });
    if (!buildSuccess) return { functionName, status: 'failed' };

    // 3. Env
    const envNeeded = await setupEnvironment({ outputDir, environment });

    // 4. Check changes
    const deployFunctionData = await checkForChanges({
      functionName,
      outputRoot: outputDir,
      flavor: deployOptions.flavor,
      force: deployOptions.force,
      outputDirectory: join(cwd(), 'dist'),
      environment: envNeeded,
    });

    if (!deployFunctionData) {
      // Cleanup early if skipped
      if (!deployOptions.debug) {
        await rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
      }
      return { functionName, status: 'skipped' };
    }

    if (deployOptions.dryRun) {
      return { functionName, status: 'dry-run', deployFunctionData, outputDir, temporaryDir };
    }

    return { functionName, status: 'to-deploy', deployFunctionData, outputDir, temporaryDir };
  } catch (error) {
    logger.error(`❌ Failed to prepare ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  }
};

/**
 * Phase 2: Execution.
 * Installs dependencies and deploys to Firebase.
 */
export const executeFunctionDeployment = async (options: {
  prepareResult: PrepareResult;
  deployOptions: DeployOptions;
}): Promise<ProcessResult> => {
  const { prepareResult, deployOptions } = options;
  const { functionName, outputDir, temporaryDir, deployFunctionData } = prepareResult;

  if (!outputDir || !deployFunctionData) {
    return { functionName, status: 'failed' };
  }

  try {
    // 1. Dependencies
    const installSuccess = await installDependencies({ outputDir, deployOptions });
    if (!installSuccess) return { functionName, status: 'failed' };

    // 2. Deploy
    const deploySuccess = await deployAction({ functionName, outputDir, deployOptions });
    if (!deploySuccess) return { functionName, status: 'failed' };

    // 3. Cache
    await cacheChecksumLocal(deployFunctionData);
    return { functionName, status: 'deployed' };
  } catch (error) {
    logger.error(`❌ Failed to deploy ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  } finally {
    if (!deployOptions.debug && temporaryDir) {
      await rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};

const setupDirectories = async (options: {
  outputDirectory: string;
  temporaryDirectory: string;
  deployOptions: DeployOptions;
  functionName: string;
}) => {
  const { outputDirectory, temporaryDirectory, deployOptions, functionName } = options;
  const { nodeVersion } = deployOptions;
  if (!nodeVersion) throw new Error('Node version is required.');

  await Promise.all([
    rm(outputDirectory, { recursive: true, force: true }),
    rm(temporaryDirectory, { recursive: true, force: true }),
  ]);

  await Promise.all([
    mkdir(join(outputDirectory, 'src'), { recursive: true }),
    mkdir(temporaryDirectory, { recursive: true }),
  ]);

  const [firebaseConfig, packageJson] = await Promise.all([
    Promise.resolve(createFirebaseConfig({ nodeVersion, functionName })),
    createPackageJson({
      nodeVersion,
      external: deployOptions.external,
      functionName,
      isEmulator: deployOptions.isEmulator,
    }),
  ]);

  await Promise.all([
    writeFile(join(outputDirectory, 'firebase.json'), firebaseConfig, 'utf-8'),
    writeFile(join(outputDirectory, 'src', 'package.json'), packageJson, 'utf-8'),
  ]);
};

const performBuild = async (options: {
  functionPath: string;
  functionName: string;
  outputDirectory: string;
  temporaryDirectory: string;
  functionsDirectoryPath: string;
  deployOptions: DeployOptions;
  functionOptions: FunctionOptions;
}): Promise<boolean> => {
  const {
    functionPath,
    functionName,
    outputDirectory,
    temporaryDirectory,
    functionsDirectoryPath,
    deployOptions,
    functionOptions,
  } = options;
  const outputFile = join(outputDirectory, 'src', 'index.js');

  try {
    const inputFile = await createTemporaryIndexFunctionFile({
      functionPath,
      functionName,
      temporaryDirectory,
      functionOptions,
      functionsDirectoryPath,
      deployFunction: deployOptions.deployFunction,
    });

    const projectRoot = await findProjectRoot();
    await buildFunction({
      inputFile,
      outputFile,
      configPath: join(projectRoot, 'package.json'),
      minify: deployOptions.minify,
      sourcemap: deployOptions.sourcemap,
      external: deployOptions.external,
      nodeVersion: deployOptions.nodeVersion,
      keepNames: deployOptions.keepNames,
    });
    return true;
  } catch (buildError) {
    logger.error(`Failed to build ${functionName}: ${(buildError as Error).message}`);
    return false;
  }
};

const setupEnvironment = async (options: {
  outputDirectory: string;
  environment: Record<string, string>;
}) => {
  const { outputDirectory, environment } = options;
  const envNeeded = await getEnvironmentNeeded({ outputDirectory, environment });
  logger.debug(`Environment needed for ${outputDirectory}:`, envNeeded);
  if (envNeeded) {
    const envCode = toDotEnvironmentCode({ env: envNeeded });
    await writeFile(join(outputDirectory, '.env'), envCode, 'utf-8');
  }
  return envNeeded;
};

const installDependencies = async (options: {
  outputDirectory: string;
  deployOptions: DeployOptions;
}): Promise<boolean> => {
  const { outputDirectory, deployOptions } = options;
  if (!deployOptions.external || deployOptions.external.length === 0) return true;

  const result = await executeCommand('npm', {
    args: ['install'],
    cwd: join(outputDirectory, 'src'),
    packageManager: 'global',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (!result.success) {
    logger.error(`Failed to install dependencies for ${outputDirectory}:`);
    logger.error(result.stderr);
    return false;
  }
  return true;
};

const deployAction = async (options: {
  functionName: string;
  outputDirectory: string;
  deployOptions: DeployOptions;
}): Promise<boolean> => {
  const { functionName, outputDirectory, deployOptions } = options;
  if (!deployOptions.projectId) throw new Error('Project ID is required.');

  const deployArgs = [
    'deploy',
    '--config',
    'firebase.json',
    '--only',
    `functions:${functionName}`,
    '--project',
    deployOptions.projectId,
  ];
  if (deployOptions.force) {
    deployArgs.push('--force');
  }

  try {
    const result = await executeCommand('firebase', {
      args: deployArgs,
      cwd: outputDirectory,
      packageManager: deployOptions.packageManager,
    });

    if (result.success) {
      logger.info(chalk.dim(`Successfully deployed ${functionName}.`));
      return true;
    }

    logger.error(`❌ Failed to deploy ${functionName}.`);
    if (result.stderr) {
      logger.error(chalk.red(result.stderr));
    }
    if (result.stdout && !deployOptions.verbose) {
      logger.error(chalk.dim(result.stdout));
    }
    return false;
  } catch (deployError) {
    logger.error(`Failed to deploy ${functionName}: ${(deployError as Error).message}`);
    return false;
  }
};
