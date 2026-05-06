import { describe, expect, test } from 'bun:test';
import {
  getLogContext,
  logContextStore,
  runWithLogContext,
  setLogContext,
  wrapWithLogContext,
} from '../../src/lib/helpers/logging.ts';

describe('Logging Context', () => {
  test('runWithLogContext sets context', async () => {
    await runWithLogContext({ source: 'functions', trigger: 'test' }, async () => {
      expect(getLogContext()?.trigger).toBe('test');
    });
  });

  test('getLogContext returns undefined outside of context', () => {
    expect(getLogContext()).toBeUndefined();
  });

  test('setLogContext merges values', async () => {
    await runWithLogContext({ source: 'functions', userId: '123' }, () => {
      setLogContext({ companyId: 'acme' });
      expect(getLogContext()?.userId).toBe('123');
      expect(getLogContext()?.companyId).toBe('acme');
    });
  });

  test('wrapWithLogContext wraps handler', async () => {
    const handler = (value: string) => {
      expect(getLogContext()?.requestId).toBe('abc');
      return `hello ${value}`;
    };

    const wrapped = wrapWithLogContext(handler, (_value) => ({
      source: 'functions',
      requestId: 'abc',
    }));

    const result = await wrapped('world');
    expect(result).toBe('hello world');
  });

  test('wrapWithLogContext preserves handler return type', async () => {
    const handler = () => ({ success: true as const, data: 42 });
    const wrapped = wrapWithLogContext(handler, () => ({ source: 'functions' }));
    const result = await wrapped();
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  test('logContextStore is exported', () => {
    expect(logContextStore).toBeDefined();
    expect(typeof logContextStore.run).toBe('function');
  });
});
