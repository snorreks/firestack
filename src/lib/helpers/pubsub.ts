import type { MessagePublishedData } from 'firebase-functions/pubsub';
import type { CloudEvent } from 'firebase-functions/v2';
import type { PubsubTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onMessagePublished = createEventHandler<
  CloudEvent<MessagePublishedData>,
  PubsubTriggerOptions
>('pubsub.onMessagePublished', (event) => event.id);
