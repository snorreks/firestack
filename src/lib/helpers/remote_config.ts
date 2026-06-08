import type { ConfigUpdateData } from 'firebase-functions/remoteConfig';
import type { CloudEvent } from 'firebase-functions/v2';
import type { RemoteConfigTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Handles a Firebase Remote Config template update event.
 *
 * @param handler Event handler that runs when a Remote Config template is updated.
 */
export const onConfigUpdated = (
  handler: (event: CloudEvent<ConfigUpdateData> & { batch: Batch }) => unknown,
  options?: RemoteConfigTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: CloudEvent<ConfigUpdateData>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'remoteConfig.onConfigUpdated',
      requestId: event.id,
    })
  );
};
