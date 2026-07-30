import type { MessagePublishedData } from 'firebase-functions/pubsub';
import type { CloudEvent } from 'firebase-functions/v2';
import type { PubsubTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a Pub/Sub message published event.
 *
 * @param handler - Handler that receives the cloud event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function, including the topic name.
 */
export const onMessagePublished = createEventHandler<
  CloudEvent<MessagePublishedData>,
  PubsubTriggerOptions
>('pubsub.onMessagePublished', (event) => event.id);
