import type { CloudEvent } from 'firebase-functions/v2';
import type { EventarcTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onCustomEventPublished = createEventHandler<
  CloudEvent<unknown>,
  EventarcTriggerOptions
>('eventarc.onCustomEventPublished', (event) => event.id);
