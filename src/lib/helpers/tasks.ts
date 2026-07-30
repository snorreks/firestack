import type { Request } from 'firebase-functions/tasks';
import type { TasksTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a Cloud Tasks task dispatch event.
 *
 * @param handler - Handler that receives the task request with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onTaskDispatched = createEventHandler<Request, TasksTriggerOptions>(
  'tasks.onTaskDispatched',
  () => crypto.randomUUID()
);
