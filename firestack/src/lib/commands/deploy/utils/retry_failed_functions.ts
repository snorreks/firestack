import { deriveFunctionName } from '../../../utils/function_naming.js';
import { logger } from '../../../utils/logger.js';
import { runFunctions } from '../../../utils/run-functions.js';
import type { DeployOptions } from './options.js';
import { processFunction } from './process_function.js';

/**
 * Retries failed function deployments.
 * @param failedFunctions The functions that failed to deploy.
 * @param functionFiles The list of all function files.
 * @param options The deployment options.
 * @param environment The environment variables.
 */
export async function retryFailedFunctions(
  failedFunctions: { functionName: string; status: string }[],
  functionFiles: string[],
  options: DeployOptions,
  environment: Record<string, string>,
  controllersPath: string
) {
  if (failedFunctions.length > 0 && options.retryAmount && options.retryAmount > 0) {
    logger.warn(`
Retrying ${failedFunctions.length} failed functions...`);
    for (let i = 0; i < options.retryAmount; i++) {
      logger.warn(`Retry attempt ${i + 1}/${options.retryAmount}`);
      const retryFiles = functionFiles.filter((file) => {
        const functionName = deriveFunctionName(file, controllersPath);
        return failedFunctions.some((f) => f.functionName === functionName);
      });
      const retryResults = (
        await runFunctions(
          retryFiles.map(
            (path) => () => processFunction(path, options, environment, controllersPath)
          ),
          options.concurrency
        )
      ).filter((r) => r);
      const newlyFailed = retryResults.filter((r) => r?.status === 'failed');
      if (newlyFailed.length === 0) {
        logger.info('All failed functions deployed successfully on retry.');
        return [];
      }
      failedFunctions = newlyFailed as {
        functionName: string;
        status: string;
      }[];
    }
  }
  return failedFunctions;
}
