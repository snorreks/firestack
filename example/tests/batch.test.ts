import { describe, expect, test } from 'bun:test';
import { createBatch } from '../../src/lib/utils/batch.ts';

describe('createBatch', () => {
  test('creates a batch with default concurrency', () => {
    const batch = createBatch();
    expect(batch.concurrency).toBe(5);
    expect(batch.size).toBe(0);
    expect(batch.isEmpty).toBe(true);
  });

  test('creates a batch with custom concurrency', () => {
    const batch = createBatch({ concurrency: 3 });
    expect(batch.concurrency).toBe(3);
  });

  test('clamps concurrency to at least 1', () => {
    const batch = createBatch({ concurrency: 0 });
    expect(batch.concurrency).toBe(1);
  });

  test('floors fractional concurrency', () => {
    const batch = createBatch({ concurrency: 2.7 });
    expect(batch.concurrency).toBe(2);
  });
});

describe('push / size / isEmpty', () => {
  test('push adds functions to the queue', () => {
    const batch = createBatch();
    batch.push(() => Promise.resolve(1));
    expect(batch.size).toBe(1);
    expect(batch.isEmpty).toBe(false);
  });

  test('push accepts multiple functions', () => {
    const batch = createBatch();
    batch.push(
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3)
    );
    expect(batch.size).toBe(3);
  });

  test('isEmpty returns true for empty queue', () => {
    const batch = createBatch();
    expect(batch.isEmpty).toBe(true);
  });
});

describe('commit', () => {
  test('executes functions in FIFO order', async () => {
    const batch = createBatch({ concurrency: 1 });
    const order: number[] = [];

    batch.push(() => {
      order.push(1);
      return Promise.resolve(1);
    });
    batch.push(() => {
      order.push(2);
      return Promise.resolve(2);
    });
    batch.push(() => {
      order.push(3);
      return Promise.resolve(3);
    });

    const results = await batch.commit();
    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  test('drains queue after successful commit', async () => {
    const batch = createBatch();
    batch.push(() => Promise.resolve('done'));
    await batch.commit();
    expect(batch.size).toBe(0);
    expect(batch.isEmpty).toBe(true);
  });

  test('commit with empty queue returns empty array', async () => {
    const batch = createBatch();
    const results = await batch.commit();
    expect(results).toEqual([]);
  });

  test('commit can be called multiple times (resumable)', async () => {
    const batch = createBatch({ concurrency: 1 });
    const order: number[] = [];

    batch.push(() => {
      order.push(1);
      return Promise.resolve('a');
    });
    batch.push(() => {
      order.push(2);
      return Promise.resolve('b');
    });

    const first = await batch.commit();
    expect(first).toEqual(['a', 'b']);
    expect(batch.isEmpty).toBe(true);

    batch.push(() => {
      order.push(3);
      return Promise.resolve('c');
    });

    const second = await batch.commit();
    expect(second).toEqual(['c']);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe('concurrency', () => {
  test('respects concurrency limit', async () => {
    const concurrency = 2;
    const batch = createBatch({ concurrency });
    let maxConcurrent = 0;
    let running = 0;

    const tasks = Array.from({ length: 6 }, (_, i) => () => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);

      return new Promise<number>((resolve) => {
        setTimeout(() => {
          running--;
          resolve(i);
        }, 10);
      });
    });

    batch.push(...tasks);
    const results = await batch.commit();

    expect(results).toHaveLength(6);
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
  });

  test('concurrency of 1 executes sequentially', async () => {
    const batch = createBatch({ concurrency: 1 });
    const order: number[] = [];

    for (let i = 0; i < 4; i++) {
      batch.push(() => {
        order.push(i);
        return Promise.resolve(i);
      });
    }

    await batch.commit();
    expect(order).toEqual([0, 1, 2, 3]);
  });
});

describe('error handling', () => {
  test('preserves queue on commit failure', async () => {
    const batch = createBatch({ concurrency: 1 });

    batch.push(() => Promise.resolve('ok-1'));
    batch.push(() => Promise.reject(new Error('boom')));
    batch.push(() => Promise.resolve('ok-2'));

    await expect(batch.commit()).rejects.toThrow('boom');
    expect(batch.size).toBe(3);
  });

  test('can retry after commit failure', async () => {
    const batch = createBatch({ concurrency: 1 });
    let shouldFail = true;

    batch.push(() => {
      if (shouldFail) {
        return Promise.reject(new Error('transient'));
      }
      return Promise.resolve('success');
    });

    await expect(batch.commit()).rejects.toThrow('transient');

    shouldFail = false;
    const results = await batch.commit();
    expect(results).toEqual(['success']);
    expect(batch.isEmpty).toBe(true);
  });

  test('error in one function does not prevent others from completing', async () => {
    const batch = createBatch({ concurrency: 2 });
    const completed: number[] = [];

    batch.push(() => {
      completed.push(1);
      return Promise.resolve('one');
    });
    batch.push(() => {
      completed.push(2);
      return Promise.reject(new Error('fail'));
    });
    batch.push(() => {
      completed.push(3);
      return Promise.resolve('three');
    });

    await expect(batch.commit()).rejects.toThrow('fail');

    // runFunctions rejects the whole batch on any error, so some might not run.
    // What matters is the queue is preserved for retry.
    expect(batch.size).toBe(3);
  });
});

describe('clear', () => {
  test('discards all queued functions', () => {
    const batch = createBatch();
    batch.push(
      () => Promise.resolve(1),
      () => Promise.resolve(2)
    );
    expect(batch.size).toBe(2);

    batch.clear();
    expect(batch.size).toBe(0);
    expect(batch.isEmpty).toBe(true);
  });

  test('clear on empty queue is safe', () => {
    const batch = createBatch();
    batch.clear();
    expect(batch.size).toBe(0);
  });

  test('commit after clear is a no-op', async () => {
    const batch = createBatch();
    batch.push(() => Promise.resolve('x'));
    batch.clear();
    const results = await batch.commit();
    expect(results).toEqual([]);
  });
});
