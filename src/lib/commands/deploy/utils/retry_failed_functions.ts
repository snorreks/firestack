import { logger } from '$logger';
import { deriveFunctionName } from '$utils/function_naming.js';
import { runFunctions } from '$utils/run-functions.js';
import type { DeployOptions } from './options.js';
import {
  executeFunctionDeployment,
  type ProcessResult,
  prepareFunction,
} from './process_function.js';

export interface RetryFailedFunctionsOptions {
  failedFunctions: ProcessResult[];
  functionFiles: string[];
  options: DeployOptions;
  environment: Record<string, string>;
  functionsPath: string;
}

/**
 * Retries failed function deployments.
 */
export async function retryFailedFunctions(
  opts: RetryFailedFunctionsOptions
): Promise<ProcessResult[]> {
  const { functionFiles, options, environment, functionsPath } = opts;
  let { failedFunctions } = opts;

  const retryAmount = Number(options.retryAmount) || 0;

  if (failedFunctions.length > 0 && retryAmount > 0) {
    logger.warn(`\nRetrying ${failedFunctions.length} failed functions...`);

    for (let i = 0; i < retryAmount; i++) {
      logger.warn(`Retry attempt ${i + 1}/${retryAmount}`);

      const retryFiles = functionFiles.filter((file) => {
        const functionName = deriveFunctionName({ funcPath: file, controllersPath: functionsPath });
        return failedFunctions.some((f) => f.functionName === functionName);
      });

      const retryResults = await runFunctions<ProcessResult>(
        retryFiles.map((path) => async () => {
          // 1. Re-prepare
          const prep = await prepareFunction({
            funcPath: path,
            options,
            environment,
            controllersPath: functionsPath,
          });

          if (prep.status !== 'to-deploy' && prep.status !== 'dry-run') {
            return { functionName: prep.functionName, status: 'failed' };
          }

          // 2. Re-execute
          return await executeFunctionDeployment({ prepareResult: prep, options });
        }),
        options.concurrency
      );

      const newlyFailed = retryResults.filter((r): r is ProcessResult => r?.status === 'failed');

      if (newlyFailed.length === 0) {
        logger.info('All failed functions deployed successfully on retry.');
        return [];
      }

      failedFunctions = newlyFailed;
    }
  }

  return failedFunctions;
}
