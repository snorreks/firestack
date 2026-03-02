import { basename, join } from 'node:path';
import { cwd, exit } from 'node:process';
import { Command } from 'commander';
import { logger } from '../../utils/logger.js';
import { runFunctions } from '../../utils/run-functions.js';
import { getEnvironment } from './utils/environment.js';
import { findFunctions } from './utils/find_functions.js';
import { type DeployOptions, getOptions } from './utils/options.js';
// import { prepareDependencies } from './utils/prepare_dependencies.js';
import { processFunction } from './utils/process_function.js';
import { retryFailedFunctions } from './utils/retry_failed_functions.js';

function cwdDir(): string {
  return cwd();
}

function exitCode(code: number): never {
  return exit(code);
}

export const deployCommand = new Command('deploy')
  .description('Builds and deploys all Firebase functions.')
  .option('--flavor <flavor>', 'The flavor to use for deployment.', 'development')
  .option('--dry-run', 'Show the deployment commands without executing them.')
  .option('--force', 'Force deploy all functions, even if no files changed.')
  .option('--verbose', 'Whether to run the command with verbose logging.')
  .option('--only <only>', 'Only deploy the given function names separated by comma.')
  .option('--region <region>', 'The default region to deploy the functions to.')
  .option('--concurrency <concurrency>', 'The number of functions to deploy in parallel.', '5')
  .option('--retryAmount <retryAmount>', 'The amount of times to retry a failed deployment.', '0')
  .option('--minify', 'Will minify the functions.', true)
  .option('--sourcemap', 'Whether to generate sourcemaps.', true)
  .option(
    '--functionsDirectory <functionsDirectory>',
    'The directory where the functions are located.'
  )
  .option('--projectId <projectId>', 'The Firebase project ID to deploy to.')
  .option('--node-version <nodeVersion>', 'The Node.js version to use for the functions.')
  .option('--debug', 'Enable debug mode (keeps temporary files).')
  .action(async (cliOptions: DeployOptions) => {
    const options = await getOptions(cliOptions);

    if (!options.projectId) {
      logger.error(
        'Project ID not found. Please provide it using --projectId option or in firestack.json.'
      );
      exitCode(1);
    }

    // await prepareDependencies(cwdDir());

    const functionsPath = join(cwdDir(), options.functionsDirectory!);
    let functionFiles = await findFunctions(functionsPath);

    if (options.only) {
      const onlyFunctions = options.only.split(',').map((f) => f.trim());
      functionFiles = functionFiles.filter((file) => {
        const functionName = basename(file).replace(/\.(ts|tsx|js)$/, '');
        return onlyFunctions.includes(functionName);
      });
    }

    if (functionFiles.length === 0) {
      logger.warn('No functions found to deploy.');
      return;
    }

    logger.info(`Found ${functionFiles.length} functions to deploy.`);

    const environment = await getEnvironment(options.flavor);

    const results = (
      await runFunctions(
        functionFiles.map(
          (path) => () => processFunction(path, options, environment, functionsPath)
        ),
        options.concurrency
      )
    ).filter((r) => r);

    let failedFunctions = results.filter((r) => r?.status === 'failed') as {
      functionName: string;
      status: string;
    }[];

    failedFunctions = await retryFailedFunctions(
      failedFunctions,
      functionFiles,
      options,
      environment,
      functionsPath
    );

    if (failedFunctions.length > 0) {
      logger.error(`\nDeployment failed for ${failedFunctions.length} functions.`);
      exitCode(1);
    }

    logger.info('\nDeployment process complete!');
  });
