import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';
import { exists } from '$utils/common.js';

interface RemoteCacheModule {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
}

/**
 * Gets the remote cache utilities from functions-cache.ts (user provided script).
 * @returns An object containing the get and update functions for the remote cache.
 */
export async function getRemoteCacheUtils(): Promise<{
  get: FunctionsCacheGet | undefined;
  update: FunctionsCacheUpdate | undefined;
}> {
  const cacheFilePath = join(cwd(), 'functions-cache.ts');

  if (!(await exists(cacheFilePath))) {
    logger.debug('Remote cache user script (functions-cache.ts) not found');
    return { get: undefined, update: undefined };
  }
  logger.debug('Remote cache user script (functions-cache.ts) found!');

  try {
    const cacheModule = (await import(cacheFilePath)) as RemoteCacheModule;

    if (!cacheModule.get || !cacheModule.update) {
      logger.warn('Remote cache user script found but missing get or update functions');
      return { get: undefined, update: undefined };
    }

    return {
      get: cacheModule.get,
      update: cacheModule.update,
    };
  } catch (error) {
    logger.debug('Error importing remote cache user script:', error);
    return { get: undefined, update: undefined };
  }
}

/**
 * Fetches the current remote cache using the provided get function.
 * @param getFn The function to use to fetch the cache.
 * @param flavor The flavor to fetch the cache for.
 * @returns The current remote cache, or undefined if it could not be fetched.
 */
export async function fetchRemoteCache(
  getFn: FunctionsCacheGet,
  flavor: string
): Promise<FunctionsCache | undefined> {
  try {
    return await getFn({ flavor });
  } catch (error) {
    logger.debug('Failed to fetch remote cache:', error);
    return undefined;
  }
}

/**
 * Updates the remote cache using the provided update function.
 * @param updateFn The function to use to update the cache.
 * @param flavor The flavor to update the cache for.
 * @param newCache The new cache to store remotely.
 */
export async function updateRemoteCache(
  updateFn: FunctionsCacheUpdate,
  flavor: string,
  newCache: FunctionsCache
): Promise<void> {
  try {
    await updateFn({ flavor, newFunctionsCache: newCache });
  } catch (error) {
    logger.error('Failed to update remote cache:', error);
  }
}
