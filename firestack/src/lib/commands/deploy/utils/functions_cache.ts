import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';

interface FunctionsCacheModule {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
}

export async function getFunctionsCache(): Promise<{
  get: FunctionsCacheGet | undefined;
  update: FunctionsCacheUpdate | undefined;
}> {
  const cacheFilePath = join(cwd(), 'functions-cache.ts');

  if (!existsSync(cacheFilePath)) {
    logger.debug('cacheFilePath not found');
    return { get: undefined, update: undefined };
  }
  logger.debug('cacheFilePath found!');

  try {
    const cacheModule = (await import(cacheFilePath)) as FunctionsCacheModule;

    if (!cacheModule.get || !cacheModule.update) {
      return { get: undefined, update: undefined };
    }

    return {
      get: cacheModule.get,
      update: cacheModule.update,
    };
  } catch (error) {
    return { get: undefined, update: undefined };
  }
}

export async function fetchFunctionsCache(
  getFn: FunctionsCacheGet,
  flavor: string
): Promise<FunctionsCache | undefined> {
  try {
    return await getFn({ flavor });
  } catch (error) {
    return undefined;
  }
}

export async function updateFunctionsCache(
  updateFn: FunctionsCacheUpdate,
  flavor: string,
  newCache: FunctionsCache
): Promise<void> {
  try {
    await updateFn({ flavor, newFunctionsCache: newCache });
  } catch (error) {
    console.error('Failed to update functions cache:', error);
  }
}
