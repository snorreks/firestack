import type { EventContext } from 'firebase-functions/v1';
import type { ScheduleOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

export const onSchedule = (
  handler: (context: EventContext & { batch: Batch }) => PromiseLike<unknown> | unknown,
  options: ScheduleOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (context: EventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...context, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (context) => ({
      source: 'functions' as const,
      trigger: 'scheduler',
      requestId: context.eventId,
    })
  );
};
