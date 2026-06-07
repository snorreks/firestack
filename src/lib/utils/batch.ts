import { logger } from '$logger';
import { runFunctions } from '$utils/run-functions.ts';

type AsyncFunction<T = unknown> = () => Promise<T>;

/**
 * A resumable, concurrency-controlled batch queue for async functions.
 *
 * Collects async operations and executes them all at once with a configurable
 * concurrency limit. After a commit drains the queue, more functions can be
 * pushed and committed again — useful for checkpoint-style patterns where
 * subsequent work depends on earlier results.
 *
 * @example
 * ```typescript
 * const batch = createBatch({ concurrency: 3 });
 * batch.push(() => updateUser(user));
 * batch.push(() => sendEmail(user));
 * await batch.commit();  // executes both, queue is now empty
 * batch.push(() => sendNotification(user));  // more work
 * await batch.commit();  // executes the new function
 * ```
 */
export class Batch {
  /** Maximum number of functions to execute concurrently. */
  readonly concurrency: number;

  private _queue: AsyncFunction[] = [];

  constructor(options: { concurrency: number }) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency));
  }

  /**
   * The number of functions currently queued and not yet executed.
   */
  get size(): number {
    return this._queue.length;
  }

  /**
   * Whether the queue is empty.
   */
  get isEmpty(): boolean {
    return this._queue.length === 0;
  }

  /**
   * Enqueue one or more async functions for later execution.
   * Functions execute in FIFO order when {@link commit} is called.
   */
  push(...functions: AsyncFunction[]): void {
    this._queue.push(...functions);
  }

  /**
   * Execute all currently-queued functions with the configured concurrency
   * limit, then drain the queue.
   *
   * Resumable — after a successful commit the queue is empty and ready for
   * more work. On failure the queue is preserved so the caller can retry.
   *
   * @returns Results from all executed functions, in queue order.
   */
  async commit(): Promise<unknown[]> {
    if (this._queue.length === 0) {
      return [];
    }

    logger.debug('Batch committing', {
      size: this._queue.length,
      concurrency: this.concurrency,
    });

    const snapshot = this._queue;
    this._queue = [];

    try {
      return await runFunctions(snapshot, this.concurrency);
    } catch (error) {
      // Restore unexecuted functions so the caller can retry
      this._queue = [...snapshot, ...this._queue];
      logger.error('Batch commit failed — queue preserved for retry', {
        error,
        remainingSize: this._queue.length,
      });
      throw error;
    }
  }

  /**
   * Discard all queued functions without executing them.
   */
  clear(): void {
    this._queue = [];
  }
}

/**
 * Creates a new Batch instance.
 *
 * @param options.concurrency - Max concurrent executions (default: 5, clamped to ≥ 1)
 */
export const createBatch = (options: { concurrency?: number } = {}): Batch => {
  return new Batch({ concurrency: options.concurrency ?? 5 });
};
