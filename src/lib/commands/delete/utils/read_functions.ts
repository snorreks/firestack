import { join } from 'node:path';
import { logger } from '$logger';
import type { DeleteCommandOptions, FunctionIdentifier } from '$types';
import { executeCommand } from '$utils/command.ts';
import { findFunctions } from '$utils/find_functions';
import { deriveFunctionName } from '$utils/function_naming.ts';

export const getLocalFunctionNames = async (
  deployOptions: DeleteCommandOptions
): Promise<FunctionIdentifier[]> => {
  try {
    if (!deployOptions.functionsDirectory) {
      throw new Error('Functions directory is required for getLocalFunctionNames.');
    }
    const functionsPath = join(process.cwd(), deployOptions.functionsDirectory);
    const localFunctionFiles = await findFunctions(functionsPath);
    const localFunctionNames = localFunctionFiles.map((file) => ({
      name: deriveFunctionName({ functionPath: file, functionsDirectoryPath: functionsPath }),
      region: deployOptions.region,
    }));
    logger.debug('localFunctionNames', localFunctionNames);
    return localFunctionNames;
  } catch (error) {
    logger.error('getLocalFunctionNames', error);
    throw error;
  }
};

export const getOnlineFunctionNames = async (
  deployOptions: DeleteCommandOptions
): Promise<FunctionIdentifier[]> => {
  try {
    if (!deployOptions.projectId) {
      throw new Error('Project ID is required for getOnlineFunctionNames.');
    }

    const commandArgs = ['functions:list', '--project', deployOptions.projectId, '--json'];

    logger.debug(`> firebase ${commandArgs.join(' ')}`);

    const { stdout, success } = await executeCommand('firebase', {
      args: commandArgs,
      packageManager: deployOptions.packageManager,
    });

    if (!success) {
      throw new Error('Failed to fetch online functions from Firebase.');
    }

    const onlineFunctions = JSON.parse(stdout);
    // Firebase CLI returns an array of functions for functions:list --json
    // Sometimes it might be wrapped in { result: [...] } depending on the version/command
    const functionList = Array.isArray(onlineFunctions)
      ? onlineFunctions
      : (onlineFunctions as { result: Record<string, unknown>[] }).result || [];

    const onlineFunctionNames = functionList.map((functionData: Record<string, unknown>) => {
      // Firebase CLI returns { id, region, project, ... } directly in each item
      return {
        name: functionData.id as string,
        region: (functionData.region as string) ?? deployOptions.region,
      };
    });
    logger.debug('onlineFunctionNames', onlineFunctionNames);
    return onlineFunctionNames;
  } catch (error) {
    logger.error('getOnlineFunctionNames', error);
    throw error;
  }
};

export const getUnusedFunctionNames = async (
  deployOptions: DeleteCommandOptions
): Promise<FunctionIdentifier[]> => {
  try {
    const [localFunctionNames, onlineFunctionNames] = await Promise.all([
      getLocalFunctionNames(deployOptions),
      getOnlineFunctionNames(deployOptions),
    ]);

    // Build a Set of "name:region" keys for local functions to enable O(1) lookups
    const localKeys = new Set(localFunctionNames.map((fn) => `${fn.name}:${fn.region}`));

    // An online function is unused if:
    // - Its name doesn't exist in local functions at all, OR
    // - Its name exists locally but in a different region
    const unusedFunctionNames = onlineFunctionNames.filter(
      (onlineFn) => !localKeys.has(`${onlineFn.name}:${onlineFn.region}`)
    );
    return unusedFunctionNames;
  } catch (error) {
    logger.error('getUnusedFunctionNames', error);
    throw error;
  }
};
