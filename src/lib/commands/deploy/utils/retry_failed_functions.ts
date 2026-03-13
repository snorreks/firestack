import { logger } from '$logger';
import type { DeployCommandOptions } from '$types';
import { deriveFunctionName } from '$utils/function_naming.ts';
import { runFunctions } from '$utils/run-functions.ts';
import {
  executeFunctionDeployment,
  type ProcessResult,
  prepareFunction,
} from './process_function.ts';

/**
 * Retries failed function deployments.
 */
export const retryFailedFunctions = async (options: {
  failedFunctions: ProcessResult[];
  functionPaths: string[];
  deployOptions: DeployCommandOptions;
  environment: Record<string, string>;
  functionsDirectoryPath: string;
}): Promise<ProcessResult[]> => {
  const { functionPaths, deployOptions, environment, functionsDirectoryPath } = options;
  let { failedFunctions } = options;

  const retryAmount = Number(deployOptions.retryAmount) || 0;

  if (failedFunctions.length > 0 && retryAmount > 0) {
    logger.warn(`\nRetrying ${failedFunctions.length} failed functions...`);

    for (let i = 0; i < retryAmount; i++) {
      logger.warn(`Retry attempt ${i + 1}/${retryAmount}`);

      const retryFiles = functionPaths.filter((functionPath) => {
        const functionName = deriveFunctionName({ functionPath, functionsDirectoryPath });
        return failedFunctions.some((f) => f.functionName === functionName);
      });

      const retryResults = await runFunctions<ProcessResult>(
        retryFiles.map((functionPath) => async () => {
          // 1. Re-prepare
          const prepareResult = await prepareFunction({
            functionPath,
            deployOptions,
            environment,
            functionsDirectoryPath,
          });

          if (prepareResult.status !== 'to-deploy' && prepareResult.status !== 'dry-run') {
            return { functionName: prepareResult.functionName, status: 'failed' };
          }

          // 2. Re-execute
          return await executeFunctionDeployment({ prepareResult, deployOptions });
        }),
        deployOptions.concurrency
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
};
