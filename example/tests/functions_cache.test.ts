import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  fetchRemoteCache,
  getCacheContext,
  getRemoteCacheUtils,
  updateRemoteCache,
} from '../../src/lib/utils/functions_cache.ts';

const TEMP_DIR = join(cwd(), '.tmp-cache-tests');

afterAll(async () => {
  await rm(TEMP_DIR, { recursive: true, force: true });
});

const writeCacheModule = async (name: string, content: string): Promise<string> => {
  await mkdir(TEMP_DIR, { recursive: true });
  const filePath = join(TEMP_DIR, name);
  await writeFile(filePath, content, 'utf-8');
  // Return a path relative to cwd() so join(cwd(), relPath) works
  return `.tmp-cache-tests/${name}`;
};

describe('functions_cache', () => {
  describe('getRemoteCacheUtils', () => {
    test('returns undefined callables when cache file does not exist', async () => {
      const result = await getRemoteCacheUtils('nonexistent-cache-file.ts');

      expect(result.getCacheCallable).toBeUndefined();
      expect(result.updateCacheCallable).toBeUndefined();
    });

    test('returns undefined callables when module is missing get export', async () => {
      const cacheFileName = await writeCacheModule(
        'missing-get.ts',
        `export const update = async () => {};\n`
      );

      const result = await getRemoteCacheUtils(cacheFileName);

      expect(result.getCacheCallable).toBeUndefined();
      expect(result.updateCacheCallable).toBeUndefined();
    });

    test('returns undefined callables when module is missing update export', async () => {
      const cacheFileName = await writeCacheModule(
        'missing-update.ts',
        `export const get = async () => ({ key: 'val' });\n`
      );

      const result = await getRemoteCacheUtils(cacheFileName);

      expect(result.getCacheCallable).toBeUndefined();
      expect(result.updateCacheCallable).toBeUndefined();
    });

    test('returns callables from a valid cache module', async () => {
      const cacheFileName = await writeCacheModule(
        'valid-cache.ts',
        [
          'export const get = async () => ({ testFunction: "abc123" });',
          'export const update = async () => {};',
          '',
        ].join('\n')
      );

      const result = await getRemoteCacheUtils(cacheFileName);

      expect(result.getCacheCallable).toBeDefined();
      expect(result.updateCacheCallable).toBeDefined();

      // Verify the get function works
      if (result.getCacheCallable) {
        const cache = await result.getCacheCallable({ mode: 'test' });
        expect(cache).toEqual({ testFunction: 'abc123' });
      }
    });
  });

  describe('fetchRemoteCache', () => {
    test('returns cache data on successful fetch', async () => {
      const mockCache = { functionA: 'checksum1', functionB: 'checksum2' };
      const mockGet = async (options: { mode: string }) => {
        expect(options.mode).toBe('production');
        return mockCache;
      };

      const result = await fetchRemoteCache({
        getCacheCallable: mockGet,
        mode: 'production',
      });

      expect(result).toEqual(mockCache);
    });

    test('returns undefined when get function returns undefined', async () => {
      const mockGet = async () => undefined;

      const result = await fetchRemoteCache({
        getCacheCallable: mockGet,
        mode: 'test',
      });

      expect(result).toBeUndefined();
    });

    test('returns undefined when get function throws', async () => {
      const mockGet = async () => {
        throw new Error('Network error');
      };

      const result = await fetchRemoteCache({
        getCacheCallable: mockGet,
        mode: 'test',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('updateRemoteCache', () => {
    test('returns true on successful update', async () => {
      let calledWith: unknown;
      const mockUpdate = async (options: {
        newFunctionsCache: Record<string, string>;
        mode: string;
      }) => {
        calledWith = options;
      };

      const newCache = { functionA: 'new-checksum' };

      const result = await updateRemoteCache({
        updateCacheCallable: mockUpdate,
        mode: 'staging',
        newCache,
      });

      expect(result).toBe(true);
      expect(calledWith).toEqual({
        newFunctionsCache: newCache,
        mode: 'staging',
      });
    });

    test('returns false when update function throws', async () => {
      const mockUpdate = async () => {
        throw new Error('Update failed');
      };

      const result = await updateRemoteCache({
        updateCacheCallable: mockUpdate,
        mode: 'test',
        newCache: { fn: 'checksum' },
      });

      expect(result).toBe(false);
    });
  });

  describe('getCacheContext', () => {
    test('returns local cache when no remote cache file exists', async () => {
      const context = await getCacheContext({
        mode: 'test',
        cloudCacheFileName: 'nonexistent-cache.ts',
      });

      expect(context.remoteUtils.getCacheCallable).toBeUndefined();
      expect(context.remoteUtils.updateCacheCallable).toBeUndefined();
      expect(context.localCache).toBeDefined();
      expect(context.mergedCache).toEqual(context.localCache);
    });

    test('merges remote cache with local when remote is available', async () => {
      const cacheFileName = await writeCacheModule(
        'integration-cache.ts',
        [
          'export const get = async () => ({ remoteFn: "remote-checksum", overlappingFn: "remote-value" });',
          'export const update = async () => {};',
          '',
        ].join('\n')
      );

      const context = await getCacheContext({
        mode: 'test',
        cloudCacheFileName: cacheFileName,
      });

      expect(context.remoteUtils.getCacheCallable).toBeDefined();
      expect(context.remoteUtils.updateCacheCallable).toBeDefined();
      // Remote data should be present in merged cache
      expect(context.mergedCache.remoteFn).toBe('remote-checksum');
    });

    test('falls back to local cache when remote get throws', async () => {
      const cacheFileName = await writeCacheModule(
        'failing-cache.ts',
        [
          'export const get = async () => { throw new Error("Network failure"); };',
          'export const update = async () => {};',
          '',
        ].join('\n')
      );

      const context = await getCacheContext({
        mode: 'test',
        cloudCacheFileName: cacheFileName,
      });

      // Callables should still be available even if get throws
      expect(context.remoteUtils.getCacheCallable).toBeDefined();
      expect(context.remoteUtils.updateCacheCallable).toBeDefined();
      // Merged cache falls back to local only
      expect(context.mergedCache).toEqual(context.localCache);
    });
  });
});
