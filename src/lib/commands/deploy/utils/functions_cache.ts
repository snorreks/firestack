import { join } from 'node:path';
import { cwd } from 'node:process';
import { logger } from '$logger';
import type { FunctionsCache, FunctionsCacheGet, FunctionsCacheUpdate } from '$types';
import { loadChecksums } from '$utils/checksum.js';
import { exists } from '$utils/common.js';

interface RemoteCacheModule {
  get: FunctionsCacheGet;
  update: FunctionsCacheUpdate;
}

export interface CacheContext {
  remoteUtils: {
    get: FunctionsCacheGet | undefined;
    update: FunctionsCacheUpdate | undefined;
  };
  localCache: Record<string, string>;
  mergedCache: Record<string, string>;
}

/**
 * Fetches the complete cache context (local and remote) in parallel.
 * @param flavor The flavor to fetch the cache for.
 * @returns The cache context.
 */
export async function getCacheContext(flavor: string): Promise<CacheContext> {
  const [remoteUtils, localCache] = await Promise.all([
    getRemoteCacheUtils(),
    loadChecksums({
      outputDirectory: join(cwd(), 'dist'),
      flavor,
    }),
  ]);

  let mergedCache: Record<string, string> = { ...localCache };

  if (remoteUtils.get) {
    const remoteCache = await fetchRemoteCache({ getFn: remoteUtils.get, flavor });
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

interface FetchRemoteCacheOptions {
  getFn: FunctionsCacheGet;
  flavor: string;
}

/**
 * Fetches the current remote cache using the provided get function.
 */
export async function fetchRemoteCache(
  opts: FetchRemoteCacheOptions
): Promise<FunctionsCache | undefined> {
  const { getFn, flavor } = opts;
  try {
    return await getFn({ flavor });
  } catch (error) {
    logger.debug('Failed to fetch remote cache:', error);
    return undefined;
  }
}

interface UpdateRemoteCacheOptions {
  updateFn: FunctionsCacheUpdate;
  flavor: string;
  newCache: FunctionsCache;
}

/**
 * Updates the remote cache using the provided update function.
 */
export async function updateRemoteCache(opts: UpdateRemoteCacheOptions): Promise<boolean> {
  const { updateFn, flavor, newCache } = opts;
  try {
    await updateFn({ flavor, newFunctionsCache: newCache });
    return true;
  } catch (error) {
    logger.error('Failed to update remote cache:', error);
    return false;
  }
}
