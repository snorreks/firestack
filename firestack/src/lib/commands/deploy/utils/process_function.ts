import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '$logger';
import { buildFunction } from '$utils/build_utils.js';
import { cacheChecksumLocal, checkForChanges } from '$utils/checksum.js';
import { findProjectRoot } from '$utils/common.js';
import {
  createFirebaseConfig,
  createPackageJson,
  toDotEnvironmentCode,
} from '$utils/firebase_utils.js';
import { deriveFunctionName } from '$utils/function_naming.js';
import { Command, cwdDir, mkdir, readTextFile, remove, writeTextFile } from '$utils/node-shim.js';
import { getEnvironmentNeeded } from '$utils/read-compiled-file.js';
import { createTemporaryIndexFunctionFile } from './create_deploy_index.js';
import type { DeployOptions } from './options.js';

export async function processFunction(
  funcPath: string,
  options: DeployOptions,
  environment: Record<string, string>,
  controllersPath: string
) {
  const functionName = deriveFunctionName(funcPath, controllersPath);
  logger.info(`\nProcessing function: ${functionName}`);

  const outputDir = join(cwdDir(), 'dist', functionName);
  const temporaryDir = join(cwdDir(), 'tmp', functionName);
  await mkdir(join(outputDir, 'src'), { recursive: true });
  await mkdir(temporaryDir, { recursive: true });

  await writeTextFile(join(outputDir, 'firebase.json'), createFirebaseConfig(options.nodeVersion!));

  await writeTextFile(
    join(outputDir, 'src', 'package.json'),
    createPackageJson(options.nodeVersion!)
  );

  const outputFile = join(outputDir, 'src', 'index.js');
  logger.debug(`Building ${funcPath} to ${outputFile}...`);

  try {
    const inputFile = await createTemporaryIndexFunctionFile({
      funcPath,
      functionName,
      temporaryDirectory: temporaryDir,
      controllersPath,
    });
    logger.debug('Temporary input file content:', await readTextFile(inputFile));

    const projectRoot = await findProjectRoot();
    await buildFunction({
      inputFile,
      outputFile,
      configPath: join(projectRoot, 'package.json'),
      minify: options.minify,
      sourcemap: options.sourcemap,
    });
    logger.debug(`Successfully built ${functionName}.`);
  } catch (buildError) {
    logger.error(`Failed to build ${functionName}: ${(buildError as Error).message}`);
    return { functionName, status: 'failed' };
  } finally {
    if (!options.debug) {
      await remove(temporaryDir, { recursive: true });
    }
  }

  const envNeeded = await getEnvironmentNeeded(outputDir, environment);
  if (envNeeded) {
    const envCode = toDotEnvironmentCode(envNeeded);
    await writeTextFile(join(outputDir, '.env'), envCode);
  }

  const deployFunctionData = await checkForChanges({
    functionName,
    outputRoot: outputDir,
    flavor: options.flavor,
    force: options.force,
    outputDirectory: join(cwdDir(), 'dist'),
    environment: envNeeded,
  });

  if (!deployFunctionData) {
    return { functionName, status: 'skipped' };
  }

  if (!options.dryRun) {
    logger.debug('Copying shared dependencies...');
    try {
      const dependenciesDir = join(cwdDir(), 'tmp', 'dependencies');
      const outputNodeModules = join(outputDir, 'node_modules');
      await remove(outputNodeModules, { recursive: true });

      // Copy node_modules
      if (existsSync(join(dependenciesDir, 'node_modules'))) {
        copyDirRecursive(join(dependenciesDir, 'node_modules'), outputNodeModules);
      }
      // Copy package.json
      if (existsSync(join(dependenciesDir, 'package.json'))) {
        copyFileSync(join(dependenciesDir, 'package.json'), join(outputDir, 'src', 'package.json'));
      }
    } catch (error) {
      logger.error('Failed to copy shared dependencies:', error);
      return { functionName, status: 'failed' };
    }

    logger.debug('Installing dependencies...');
    const npmInstall = new Command('npm', {
      args: ['install'],
      cwd: join(outputDir, 'src'),
    });
    const { code: npmCode, stderr: npmStderr } = await npmInstall.output();
    if (npmCode !== 0) {
      logger.error('Failed to install dependencies:');
      logger.error(new TextDecoder().decode(npmStderr));
      return { functionName, status: 'failed' };
    }
    logger.debug('Dependencies installed successfully.');
  }

  const deployArgs = [
    'deploy',
    '--only',
    `functions:${functionName}`,
    '--project',
    options.projectId!,
  ];
  if (options.force) {
    deployArgs.push('--force');
  }

  logger.debug(`> firebase ${deployArgs.join(' ')}`);

  if (!options.dryRun) {
    try {
      const command = new Command('firebase', {
        args: deployArgs,
        cwd: outputDir,
      });
      const { success } = await command.spawn().status;
      if (success) {
        logger.info(`Successfully deployed ${functionName}.`);
        await cacheChecksumLocal(deployFunctionData);
        return { functionName, status: 'deployed' };
      }
      logger.error(`Failed to deploy ${functionName}.`);
      return { functionName, status: 'failed' };
    } catch (deployError) {
      logger.error(`Failed to deploy ${functionName}: ${(deployError as Error).message}`);
      return { functionName, status: 'failed' };
    }
  } else {
    logger.info(`Dry run: skipped deployment of ${functionName}.`);
    return { functionName, status: 'dry-run' };
  }
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
