import type { Request } from 'firebase-functions/tasks';
import type { TasksTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onTaskDispatched = createEventHandler<Request, TasksTriggerOptions>(
  'tasks.onTaskDispatched',
  () => crypto.randomUUID()
);
