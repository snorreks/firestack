import type { CloudEvent } from 'firebase-functions/v2';
import type { EventarcTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Handles an Eventarc event published on a custom channel.
 *
 * @param handler Event handler that runs when a custom Eventarc event is published.
 */
export const onCustomEventPublished = (
  handler: (event: CloudEvent<unknown> & { batch: Batch }) => unknown,
  options?: EventarcTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: CloudEvent<unknown>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'eventarc.onCustomEventPublished',
      requestId: event.id,
    })
  );
};
