import type {
  AfterGenerateContentData,
  AIBlockingEvent,
  BeforeGenerateContentData,
} from 'firebase-functions/ai';
import type { AiTriggerOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Blocks an AI content generation request before it's processed.
 *
 * @param handler Event handler that runs before content is generated.
 *   Return a partial request to modify the generation parameters.
 */
export const beforeGenerateContent = (
  handler: (event: AIBlockingEvent<BeforeGenerateContentData> & { batch: Batch }) => unknown,
  options?: AiTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: AIBlockingEvent<BeforeGenerateContentData>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'ai.beforeGenerateContent',
      requestId: event.id,
    })
  );
};

/**
 * Intercepts an AI content generation response after it's produced.
 *
 * @param handler Event handler that runs after content is generated.
 *   Return a partial response to modify the result.
 */
export const afterGenerateContent = (
  handler: (event: AIBlockingEvent<AfterGenerateContentData> & { batch: Batch }) => unknown,
  options?: AiTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: AIBlockingEvent<AfterGenerateContentData>) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger: 'ai.afterGenerateContent',
      requestId: event.id,
    })
  );
};
