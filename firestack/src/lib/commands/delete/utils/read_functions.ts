import { basename, join } from 'node:path';
import client from 'firebase-tools';
import { logger } from '../../../utils/logger.js';
import { findFunctions } from '../../deploy/utils/find_functions.js';
import type { DeployOptions } from '../../deploy/utils/options.js';

export async function getLocalFunctionNames(options: DeployOptions): Promise<string[]> {
  try {
    const functionsPath = join(process.cwd(), options.functionsDirectory!);
    const localFunctionFiles = await findFunctions(functionsPath);
    const localFunctionNames = localFunctionFiles.map((file) =>
      basename(file).replace(/\.(ts|tsx|js)$/, '')
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
    const onlineFunctions = await client.functions.list({
      project: options.projectId!,
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
