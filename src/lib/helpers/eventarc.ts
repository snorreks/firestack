import type { CloudEvent } from 'firebase-functions/v2';
import type { EventarcTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a custom Eventarc event.
 *
 * @param handler - Handler that receives the cloud event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onCustomEventPublished = createEventHandler<
  CloudEvent<unknown>,
  EventarcTriggerOptions
>('eventarc.onCustomEventPublished', (event) => event.id);
