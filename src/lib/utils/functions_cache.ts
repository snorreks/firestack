import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { CacheContext, FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';
import { loadChecksums } from '$utils/checksum.ts';
import { exists } from '$utils/common.ts';

type RemoteCacheModule = {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
};

/**
 * Fetches the complete cache context (local and remote) in parallel.
 * @param options - Configuration options
 * @returns The cache context.
 */
export const getCacheContext = async (options: {
  flavor: string;
  cloudCacheFileName: string;
}): Promise<CacheContext> => {
  const { flavor, cloudCacheFileName } = options;
  const [remoteUtils, localCache] = await Promise.all([
    getRemoteCacheUtils(cloudCacheFileName),
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
 * Gets the remote cache utilities from the user provided cache script.
 * @param cloudCacheFileName - The name of the cache file in the project root.
 * @returns An object containing the get and update functions for the remote cache.
 */
export const getRemoteCacheUtils = async (
  cloudCacheFileName: string
): Promise<{
  getCacheCallable: FunctionsCacheGet | undefined;
  updateCacheCallable: FunctionsCacheUpdate | undefined;
}> => {
  const cacheFilePath = join(cwd(), cloudCacheFileName);

  if (!(await exists(cacheFilePath))) {
    logger.debug(`Remote cache user script (${cloudCacheFileName}) not found`);
    return { getCacheCallable: undefined, updateCacheCallable: undefined };
  }
  logger.debug(`Remote cache user script (${cloudCacheFileName}) found!`);

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
