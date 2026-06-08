import type { MessagePublishedData } from 'firebase-functions/pubsub';
import type { CloudEvent } from 'firebase-functions/v2';
import type { PubsubTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Handles a message published to a Pub/Sub topic.
 *
 * @param handler Event handler that runs every time a Pub/Sub message is published.
 */
export const onMessagePublished = (
  handler: (event: CloudEvent<MessagePublishedData> & { batch: Batch }) => unknown,
  options?: PubsubTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: CloudEvent<MessagePublishedData>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'pubsub.onMessagePublished',
      requestId: event.id,
    })
  );
};
