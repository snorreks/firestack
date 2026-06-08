import type { EventContext } from 'firebase-functions/v1';
import type { ScheduleOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onSchedule = createEventHandler<EventContext, ScheduleOptions>(
  'scheduler',
  (context) => context.eventId
);
