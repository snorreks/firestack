import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
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

interface ProcessResult {
  functionName: string;
  status: 'deployed' | 'skipped' | 'failed' | 'dry-run';
}

/**
 * Processes a single function for deployment.
 * This includes building the function, checking for changes, and deploying it to Firebase.
 * @param funcPath The path to the function file.
 * @param options The deployment options.
 * @param environment The environment variables for the function.
 * @param controllersPath The path to the functions directory.
 * @returns The result of the processing.
 */
export async function processFunction(
  funcPath: string,
  options: DeployOptions,
  environment: Record<string, string>,
  controllersPath: string
): Promise<ProcessResult> {
  const functionName = deriveFunctionName(funcPath, controllersPath);
  logger.info(`\nProcessing function: ${functionName}`);

  const outputDir = join(cwd(), 'dist', functionName);
  const temporaryDir = join(cwd(), 'tmp', functionName);

  try {
    await setupDirectories(outputDir, temporaryDir, options);

    const buildSuccess = await performBuild(
      funcPath,
      functionName,
      outputDir,
      temporaryDir,
      controllersPath,
      options
    );
    if (!buildSuccess) return { functionName, status: 'failed' };

    const envNeeded = await setupEnvironment(outputDir, environment);

    const deployFunctionData = await checkForChanges({
      functionName,
      outputRoot: outputDir,
      flavor: options.flavor,
      force: options.force,
      outputDirectory: join(cwd(), 'dist'),
      environment: envNeeded,
    });

    if (!deployFunctionData) {
      return { functionName, status: 'skipped' };
    }

    if (!options.dryRun) {
      const installSuccess = await installDependencies(outputDir, options);
      if (!installSuccess) return { functionName, status: 'failed' };

      const deploySuccess = await deployFunction(functionName, outputDir, options);
      if (deploySuccess) {
        await cacheChecksumLocal(deployFunctionData);
        return { functionName, status: 'deployed' };
      }
      return { functionName, status: 'failed' };
    }

    logger.info(`Dry run: skipped deployment of ${functionName}.`);
    return { functionName, status: 'dry-run' };
  } catch (error) {
    logger.error(`Failed to process ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  } finally {
    if (!options.debug) {
      await rm(temporaryDir, { recursive: true, force: true });
    }
  }
}

async function setupDirectories(outputDir: string, temporaryDir: string, options: DeployOptions) {
  if (!options.nodeVersion) {
    throw new Error('Node version is required for deployment.');
  }

  // Delete specific function output and temporary directories before each build
  await rm(outputDir, { recursive: true, force: true });
  await rm(temporaryDir, { recursive: true, force: true });

  await mkdir(join(outputDir, 'src'), { recursive: true });
  await mkdir(temporaryDir, { recursive: true });

  await writeFile(
    join(outputDir, 'firebase.json'),
    createFirebaseConfig(options.nodeVersion),
    'utf-8'
  );
  await writeFile(
    join(outputDir, 'src', 'package.json'),
    createPackageJson(options.nodeVersion, options.external),
    'utf-8'
  );
}

async function performBuild(
  funcPath: string,
  functionName: string,
  outputDir: string,
  temporaryDir: string,
  controllersPath: string,
  options: DeployOptions
): Promise<boolean> {
  const outputFile = join(outputDir, 'src', 'index.js');
  logger.debug(`Building ${funcPath} to ${outputFile}...`);

  try {
    const inputFile = await createTemporaryIndexFunctionFile({
      funcPath,
      functionName,
      temporaryDirectory: temporaryDir,
      controllersPath,
    });

    const projectRoot = await findProjectRoot();
    await buildFunction({
      inputFile,
      outputFile,
      configPath: join(projectRoot, 'package.json'),
      minify: options.minify,
      sourcemap: options.sourcemap,
      external: options.external,
    });
    logger.debug(`Successfully built ${functionName}.`);
    return true;
  } catch (buildError) {
    logger.error(`Failed to build ${functionName}: ${(buildError as Error).message}`);
    return false;
  }
}

async function setupEnvironment(outputDir: string, environment: Record<string, string>) {
  const envNeeded = await getEnvironmentNeeded(outputDir, environment);
  if (envNeeded) {
    const envCode = toDotEnvironmentCode(envNeeded);
    await writeFile(join(outputDir, '.env'), envCode, 'utf-8');
  }
  return envNeeded;
}

async function installDependencies(outputDir: string, options: DeployOptions): Promise<boolean> {
  if (!options.external || options.external.length === 0) {
    return true;
  }

  logger.debug('Installing external dependencies...');
  const result = await executeCommand('npm', {
    args: ['install'],
    cwd: join(outputDir, 'src'),
    packageManager: 'global', // Force npm as requested for Firebase functions
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (!result.success) {
    logger.error('Failed to install dependencies:');
    logger.error(result.stderr);
    return false;
  }
  logger.debug('Dependencies installed successfully.');
  return true;
}

async function deployFunction(
  functionName: string,
  outputDir: string,
  options: DeployOptions
): Promise<boolean> {
  if (!options.projectId) {
    throw new Error('Project ID is required for deployment.');
  }

  const deployArgs = [
    'deploy',
    '--config',
    'firebase.json',
    '--only',
    `functions:${functionName}`,
    '--project',
    options.projectId,
  ];
  if (options.force) {
    deployArgs.push('--force');
  }

  logger.debug(`> firebase ${deployArgs.join(' ')}`);

  try {
    const result = await executeCommand('firebase', {
      args: deployArgs,
      cwd: outputDir,
      packageManager: options.packageManager,
    });
    if (result.success) {
      logger.info(`Successfully deployed ${functionName}.`);
      return true;
    }
    logger.error(`Failed to deploy ${functionName}.`);
    return false;
  } catch (deployError) {
    logger.error(`Failed to deploy ${functionName}: ${(deployError as Error).message}`);
    return false;
  }
}
