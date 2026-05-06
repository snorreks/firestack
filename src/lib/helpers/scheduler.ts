import type { EventContext } from 'firebase-functions/v1';
import type { ScheduleOptions } from '$types';
import { wrapWithLogContext } from './logging.ts';

export const onSchedule = (
  handler: (context: EventContext) => PromiseLike<unknown> | unknown,
  _options: ScheduleOptions
) => {
  return wrapWithLogContext(handler, (context) => ({
    source: 'functions' as const,
    trigger: 'scheduler',
    requestId: context.eventId,
  }));
};
