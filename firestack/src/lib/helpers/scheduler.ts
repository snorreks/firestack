import type { EventContext } from 'firebase-functions/v1';
import type { ScheduleOptions } from '../types/index.js';

export const onSchedule = (
  handler: (context: EventContext) => PromiseLike<unknown> | unknown,
  _options: ScheduleOptions
) => handler;
