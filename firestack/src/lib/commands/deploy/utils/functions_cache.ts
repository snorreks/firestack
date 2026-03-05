import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';

interface FunctionsCacheModule {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
}

/**
 * Gets the functions cache utilities from functions-cache.ts.
 * @returns An object containing the get and update functions for the cache.
 */
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
  } catch (_error) {
    return { get: undefined, update: undefined };
  }
}

/**
 * Fetches the current functions cache using the provided get function.
 * @param getFn The function to use to fetch the cache.
 * @param flavor The flavor to fetch the cache for.
 * @returns The current functions cache, or undefined if it could not be fetched.
 */
export async function fetchFunctionsCache(
  getFn: FunctionsCacheGet,
  flavor: string
): Promise<FunctionsCache | undefined> {
  try {
    return await getFn({ flavor });
  } catch (_error) {
    return undefined;
  }
}

/**
 * Updates the functions cache using the provided update function.
 * @param updateFn The function to use to update the cache.
 * @param flavor The flavor to update the cache for.
 * @param newCache The new functions cache.
 */
export async function updateFunctionsCache(
  updateFn: FunctionsCacheUpdate,
  flavor: string,
  newCache: FunctionsCache
): Promise<void> {
  try {
    await updateFn({ flavor, newFunctionsCache: newCache });
  } catch (error) {
    logger.error('Failed to update functions cache:', error);
  }
}
