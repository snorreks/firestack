import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';
import { loadChecksums } from '$utils/checksum.ts';
import { exists } from '$utils/common.ts';

type RemoteCacheModule = {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
};

export type CacheContext = {
  remoteUtils: {
    getCacheCallable: FunctionsCacheGet | undefined;
    updateCacheCallable: FunctionsCacheUpdate | undefined;
  };
  localCache: Record<string, string>;
  mergedCache: Record<string, string>;
};

/**
 * Fetches the complete cache context (local and remote) in parallel.
 * @param flavor The flavor to fetch the cache for.
 * @returns The cache context.
 */
export const getCacheContext = async (flavor: string): Promise<CacheContext> => {
  const [remoteUtils, localCache] = await Promise.all([
    getRemoteCacheUtils(),
    loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor,
    }),
  ]);

  let mergedCache: Record<string, string> = { ...localCache };

  if (remoteUtils.getCacheCallable) {
    const remoteCache = await fetchRemoteCache({
      getCacheCallable: remoteUtils.getCacheCallable,
      flavor,
    });
    if (remoteCache) {
      logger.debug('Using remote cache, merging with local');
      mergedCache = { ...mergedCache, ...remoteCache };
    }
  }

  return {
    remoteUtils,
    localCache,
    mergedCache,
  };
};

/**
 * Gets the remote cache utilities from functions-cache.ts (user provided script).
 * @returns An object containing the get and update functions for the remote cache.
 */
export const getRemoteCacheUtils = async (): Promise<{
  getCacheCallable: FunctionsCacheGet | undefined;
  updateCacheCallable: FunctionsCacheUpdate | undefined;
}> => {
  const cacheFilePath = join(cwd(), 'functions-cache.ts');

  if (!(await exists(cacheFilePath))) {
    logger.debug('Remote cache user script (functions-cache.ts) not found');
    return { getCacheCallable: undefined, updateCacheCallable: undefined };
  }
  logger.debug('Remote cache user script (functions-cache.ts) found!');

  try {
    const cacheModule = (await import(cacheFilePath)) as RemoteCacheModule;

    if (!cacheModule.get || !cacheModule.update) {
      logger.warn('Remote cache user script found but missing get or update functions');
      return { getCacheCallable: undefined, updateCacheCallable: undefined };
    }

    return {
      getCacheCallable: cacheModule.get,
      updateCacheCallable: cacheModule.update,
    };
  } catch (error) {
    logger.debug('Error importing remote cache user script:', error);
    return { getCacheCallable: undefined, updateCacheCallable: undefined };
  }
};

/**
 * Fetches the current remote cache using the provided get function.
 */
export const fetchRemoteCache = async (options: {
  getCacheCallable: FunctionsCacheGet;
  flavor: string;
}): Promise<FunctionsCache | undefined> => {
  const { getCacheCallable, flavor } = options;
  try {
    return await getCacheCallable({ flavor });
  } catch (error) {
    logger.debug('Failed to fetch remote cache:', error);
    return undefined;
  }
};

/**
 * Updates the remote cache using the provided update function.
 */
export const updateRemoteCache = async (options: {
  updateCacheCallable: FunctionsCacheUpdate;
  flavor: string;
  newCache: FunctionsCache;
}): Promise<boolean> => {
  const { updateCacheCallable, flavor, newCache } = options;
  try {
    await updateCacheCallable({ flavor, newFunctionsCache: newCache });
    return true;
  } catch (error) {
    logger.error('Failed to update remote cache:', error);
    return false;
  }
};
