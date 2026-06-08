import type { Batch } from '$utils/batch.ts';
import { createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

type EventHandlerOptions = {
  batchConcurrency?: number;
};

/**
 * Shared factory for single-argument event-style handlers.
 *
 * Creates a handler wrapper that injects a fresh Batch per invocation,
 * runs the user handler, and auto-commits any queued work.
 *
 * @param trigger - Log context trigger string (e.g. 'pubsub.onMessagePublished')
 * @param getRequestId - Extracts the request ID from the event for log correlation
 */
export const createEventHandler = <
  TEvent,
  TOptions extends EventHandlerOptions = EventHandlerOptions,
>(
  trigger: string,
  getRequestId: (event: TEvent) => string
) => {
  return (handler: (event: TEvent & { batch: Batch }) => unknown, options?: TOptions) => {
    const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

    return wrapWithLogContext(
      async (event: TEvent) => {
        const batch = createBatch({ concurrency });
        const result = await handler({ ...event, batch });
        if (!batch.isEmpty) {
          await batch.commit();
        }
        return result;
      },
      (event) => ({
        source: 'functions' as const,
        trigger,
        requestId: getRequestId(event),
      })
    );
  };
};

/**
 * Shared factory for two-argument auth-style handlers.
 *
 * Handlers receive `(user, context & { batch })` where context is enriched
 * with a fresh Batch per invocation.
 *
 * @param trigger - Log context trigger string (e.g. 'identity.beforeUserCreated')
 * @param getRequestId - Extracts the request ID from user/context for log correlation
 */
export const createAuthEventHandler = <
  TUser,
  TContext,
  TOptions extends EventHandlerOptions = EventHandlerOptions,
>(
  trigger: string,
  getRequestId: (user: TUser, context: TContext) => string
) => {
  return (
    handler: (user: TUser, context: TContext & { batch: Batch }) => unknown,
    options?: TOptions
  ) => {
    const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

    return wrapWithLogContext(
      async (user: TUser, context: TContext) => {
        const batch = createBatch({ concurrency });
        const result = await handler(user, { ...context, batch });
        if (!batch.isEmpty) {
          await batch.commit();
        }
        return result;
      },
      (_user, context) => ({
        source: 'functions' as const,
        trigger,
        requestId: getRequestId(_user, context),
      })
    );
  };
};
