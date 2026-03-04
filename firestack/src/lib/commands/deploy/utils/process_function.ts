import {
  mkdir as mkdirProm,
  readFile as readFileProm,
  rm,
  writeFile as writeFileProm,
} from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { logger } from '$logger';
import { buildFunction } from '$utils/build_utils.js';
import { cacheChecksumLocal, checkForChanges } from '$utils/checksum.js';
import { Command } from '$utils/command.js';
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

function cwdDir(): string {
  return cwd();
}

function exitCode(code: number): never {
  return exit(code);
}

async function readTextFile(path: string): Promise<string> {
  return readFileProm(path, 'utf-8');
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await writeFileProm(path, contents, 'utf-8');
}

async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
  await mkdirProm(path, { recursive: options?.recursive ?? false });
}

async function remove(path: string, options?: { recursive?: boolean }): Promise<void> {
  await rm(path, { recursive: options?.recursive ?? false, force: true });
}

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
    // TODO check if they have external options, then install the external depndenvies
    // logger.debug('Installing dependencies...');
    // const npmInstall = new Command('npm', {
    //   args: ['install'],
    //   cwd: join(outputDir, 'src'),
    // });
    // const { code: npmCode, stderr: npmStderr } = await npmInstall.output();
    // if (npmCode !== 0) {
    //   logger.error('Failed to install dependencies:');
    //   logger.error(new TextDecoder().decode(npmStderr));
    //   return { functionName, status: 'failed' };
    // }
    // logger.debug('Dependencies installed successfully.');
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
