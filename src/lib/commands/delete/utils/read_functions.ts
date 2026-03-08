import { join } from 'node:path';
import client from 'firebase-tools';
import { findFunctions } from '$commands/deploy/utils/find_functions.ts';
import type { DeployOptions } from '$commands/deploy/utils/options.ts';
import { logger } from '$logger';
import { deriveFunctionName } from '$utils/function_naming.ts';

export const getLocalFunctionNames = async (deployOptions: DeployOptions): Promise<string[]> => {
  try {
    if (!deployOptions.functionsDirectory) {
      throw new Error('Functions directory is required for getLocalFunctionNames.');
    }
    const functionsPath = join(process.cwd(), deployOptions.functionsDirectory);
    const localFunctionFiles = await findFunctions(functionsPath);
    const localFunctionNames = localFunctionFiles.map((file) =>
      deriveFunctionName({ functionPath: file, functionsDirectoryPath: functionsPath })
    );
    logger.debug('localFunctionNames', localFunctionNames);
    return localFunctionNames;
  } catch (error) {
    logger.error('getLocalFunctionNames', error);
    throw error;
  }
};

export const getOnlineFunctionNames = async (deployOptions: DeployOptions): Promise<string[]> => {
  try {
    if (!deployOptions.projectId) {
      throw new Error('Project ID is required for getOnlineFunctionNames.');
    }
    const onlineFunctions = await client.functions.list({
      project: deployOptions.projectId,
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
};

export const getUnusedFunctionNames = async (deployOptions: DeployOptions): Promise<string[]> => {
  try {
    const [localFunctionNames, onlineFunctionNames] = await Promise.all([
      getLocalFunctionNames(deployOptions),
      getOnlineFunctionNames(deployOptions),
    ]);

    const unusedFunctionNames = onlineFunctionNames.filter(
      (onlineFunctionName) => !localFunctionNames.includes(onlineFunctionName)
    );
    return unusedFunctionNames;
  } catch (error) {
    logger.error('getUnusedFunctionNames', error);
    throw error;
  }
};
