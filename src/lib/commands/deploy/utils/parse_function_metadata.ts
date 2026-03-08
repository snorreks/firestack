import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { logger } from '$logger';
import type { DeployFunction, FirestackOptions, FunctionOptions, NodeVersion } from '$types';
import { deriveFunctionName } from '$utils/function_naming.ts';
import { extractAndValidateOptions } from './parse_function_options.ts';

export type FunctionMetadata = {
  functionPath: string;
  relativePath: string;
  deployFunction: DeployFunction;
  functionOptions: FunctionOptions;
  firestackOptions: FirestackOptions;
};

export const parseFunctionMetadata = async (options: {
  functionPath: string;
  functionsDirectoryPath: string;
  defaultRegion?: string;
  defaultNodeVersion?: string;
}): Promise<FunctionMetadata | undefined> => {
  const { functionPath, functionsDirectoryPath, defaultRegion, defaultNodeVersion } = options;
  try {
    const code = await readFile(functionPath, 'utf-8');
    const { deployFunction, functionOptions, firestackOptions } = extractAndValidateOptions({
      fileContent: code,
      functionPath,
      defaultRegion,
    });

    if (!deployFunction) {
      return undefined;
    }

    const derivedName = deriveFunctionName(options);
    firestackOptions.functionName = (firestackOptions.functionName as string) ?? derivedName;
    firestackOptions.nodeVersion =
      (firestackOptions.nodeVersion as NodeVersion) ?? defaultNodeVersion ?? '22';
    functionOptions.region = functionOptions.region as string | undefined;
    const relativePath = relative(functionsDirectoryPath, functionPath).replace(/\\/g, '/');

    return {
      functionPath,
      relativePath,
      deployFunction,
      functionOptions,
      firestackOptions,
    };
  } catch (error) {
    logger.debug(`Failed to parse metadata for ${functionPath}:`, error);
    return undefined;
  }
};

export const filterFunctionsByOnly = (options: {
  functionMetadata: FunctionMetadata[];
  only: string[];
}): FunctionMetadata[] => {
  const { functionMetadata, only } = options;
  if (!only || only.length === 0) {
    return functionMetadata;
  }

  const onlySet = new Set(only);
  const matched = functionMetadata.filter((f) =>
    onlySet.has(f.firestackOptions.functionName as string)
  );

  if (matched.length !== only.length) {
    const missing = only.filter(
      (name) => !functionMetadata.some((f) => f.firestackOptions.functionName === name)
    );
    if (missing.length > 0) {
      logger.warn(`Functions not found: ${missing.join(', ')}`);
    }
  }

  return matched;
};
