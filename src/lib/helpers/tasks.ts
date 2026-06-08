import type { Request } from 'firebase-functions/tasks';
import type { TasksTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Handles a task dispatched from a Google Cloud Tasks queue.
 *
 * @param handler Event handler that runs when a task is dispatched.
 */
export const onTaskDispatched = (
  handler: (request: Request & { batch: Batch }) => unknown,
  options?: TasksTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (request: Request) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...request, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'tasks.onTaskDispatched',
      requestId: crypto.randomUUID(),
    })
  );
};
