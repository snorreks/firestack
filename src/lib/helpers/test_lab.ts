import type { TestMatrixCompletedData } from 'firebase-functions/testLab';
import type { CloudEvent } from 'firebase-functions/v2';
import type { TestLabTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Handles a Firebase Test Lab test matrix completion event.
 *
 * @param handler Event handler that runs when a test matrix completes.
 */
export const onTestMatrixCompleted = (
  handler: (event: CloudEvent<TestMatrixCompletedData> & { batch: Batch }) => unknown,
  options?: TestLabTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: CloudEvent<TestMatrixCompletedData>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'testLab.onTestMatrixCompleted',
      requestId: event.id,
    })
  );
};
