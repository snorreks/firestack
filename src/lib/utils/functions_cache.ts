import { join } from 'node:path';
import { cwd, env as processEnv } from 'node:process';
import { logger } from '$logger';
import type { CacheContext, FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';
import { loadChecksums } from '$utils/checksum.ts';
import { exists } from '$utils/common.ts';
import { getEnvironment } from '$utils/environment.ts';

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
  mode: string;
  cloudCacheFileName: string;
}): Promise<CacheContext> => {
  const { mode, cloudCacheFileName } = options;
  const [remoteUtils, localCache] = await Promise.all([
    getRemoteCacheUtils(cloudCacheFileName, mode),
    loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      mode,
    }),
  ]);

  let mergedCache: Record<string, string> = { ...localCache };

  if (remoteUtils.getCacheCallable) {
    const remoteCache = await fetchRemoteCache({
      getCacheCallable: remoteUtils.getCacheCallable,
      mode,
    });
    if (remoteCache) {
      logger.debug('Using remote cache, merging with local');
      // Local takes priority: after a partial failure, the remote cache may
      // be stale (not synced), but the local per-function files are up-to-date.
      mergedCache = { ...remoteCache, ...mergedCache };
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
  cloudCacheFileName: string,
  mode: string
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

  // Load environment variables from .env and .env.{mode} before importing
  // the user's cache script, so it has access to required env vars (e.g. REDIS_URL).
  try {
    const env = await getEnvironment(mode);
    for (const [key, value] of Object.entries(env)) {
      processEnv[key] = value;
    }
    logger.debug(`Injected environment variables for cache script (${cloudCacheFileName})`);
  } catch (error) {
    logger.debug('Failed to load environment for cache script:', error);
  }

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
  mode: string;
}): Promise<FunctionsCache | undefined> => {
  const { getCacheCallable, mode } = options;
  try {
    return await getCacheCallable({ mode });
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
  mode: string;
  newCache: FunctionsCache;
}): Promise<boolean> => {
  const { updateCacheCallable, mode, newCache } = options;
  try {
    await updateCacheCallable({ mode, newFunctionsCache: newCache });
    return true;
  } catch (error) {
    logger.error('Failed to update remote cache:', error);
    return false;
  }
};
