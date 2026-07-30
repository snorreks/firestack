import type { EventContext } from 'firebase-functions/v1';
import type { ScheduleOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a scheduled function invocation (cron job).
 *
 * @param handler - Handler that receives the event context with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function, including the schedule expression.
 */
export const onSchedule = createEventHandler<EventContext, ScheduleOptions>(
  'scheduler',
  (context) => context.eventId
);
