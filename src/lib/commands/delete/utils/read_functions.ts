import { join } from 'node:path';
import client from 'firebase-tools';
import { findFunctions } from '$commands/deploy/utils/find_functions.js';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';
import { deriveFunctionName } from '$utils/function_naming.js';

export async function getLocalFunctionNames(options: DeployOptions): Promise<string[]> {
  try {
    if (!options.functionsDirectory) {
      throw new Error('Functions directory is required for getLocalFunctionNames.');
    }
    const functionsPath = join(process.cwd(), options.functionsDirectory);
    const localFunctionFiles = await findFunctions(functionsPath);
    const localFunctionNames = localFunctionFiles.map((file) =>
      deriveFunctionName({ funcPath: file, controllersPath: functionsPath })
    );
    logger.debug('localFunctionNames', localFunctionNames);
    return localFunctionNames;
  } catch (error) {
    logger.error('getLocalFunctionNames', error);
    throw error;
  }
}

export async function getOnlineFunctionNames(options: DeployOptions): Promise<string[]> {
  try {
    if (!options.projectId) {
      throw new Error('Project ID is required for getOnlineFunctionNames.');
    }
    const onlineFunctions = await client.functions.list({
      project: options.projectId,
    });
    const onlineFunctionNames = onlineFunctions.map(
      (functionData: { id: string }) => functionData.id
    );
    logger.debug('onlineFunctionNames', onlineFunctionNames);
    return onlineFunctionNames;
  } catch (error) {
    logger.error('getOnlineFunctionNames', error);
    throw error;
  }
}

export async function getUnusedFunctionNames(options: DeployOptions): Promise<string[]> {
  try {
    const [localFunctionNames, onlineFunctionNames] = await Promise.all([
      getLocalFunctionNames(options),
      getOnlineFunctionNames(options),
    ]);

    const unusedFunctionNames = onlineFunctionNames.filter(
      (onlineFunctionName) => !localFunctionNames.includes(onlineFunctionName)
    );
    return unusedFunctionNames;
  } catch (error) {
    logger.error('getUnusedFunctionNames', error);
    throw error;
  }
}
