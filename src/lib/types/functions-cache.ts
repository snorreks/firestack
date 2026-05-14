export type FunctionsCache = {
  [functionName: string]: string;
};

/**
 * Having a cloud-cache.ts file in the root of the project allows you to get
 * and update the cloud cache.
 *
 * The name of the function has to be `get` and the return type has to be
 * `FunctionsCache | undefined`.
 *
 * @example export const get: FunctionsCacheGet = async () => {
 *
 * const doc = await db.doc('cloudCache').get();
 *
 * return doc.data() as FunctionsCache; };
 */
export type FunctionsCacheGet = (options: { mode: string }) => Promise<FunctionsCache | undefined>;

/**
 * Having a cloud-cache.ts file in the root of the project allows you to get
 * and update the cloud cache.
 *
 * The name of the function has to be `update` and the parameter type has to be
 * `FunctionsCache`.
 */
export type FunctionsCacheUpdate = (options: {
  newFunctionsCache: FunctionsCache;
  mode: string;
}) => Promise<void>;

export type CacheContext = {
  remoteUtils: {
    getCacheCallable: FunctionsCacheGet | undefined;
    updateCacheCallable: FunctionsCacheUpdate | undefined;
  };
  localCache: Record<string, string>;
  mergedCache: Record<string, string>;
};
