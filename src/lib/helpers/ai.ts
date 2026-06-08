import type {
  AfterGenerateContentData,
  AIBlockingEvent,
  BeforeGenerateContentData,
} from 'firebase-functions/ai';
import type { AiTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const beforeGenerateContent = createEventHandler<
  AIBlockingEvent<BeforeGenerateContentData>,
  AiTriggerOptions
>('ai.beforeGenerateContent', (event) => event.id);

export const afterGenerateContent = createEventHandler<
  AIBlockingEvent<AfterGenerateContentData>,
  AiTriggerOptions
>('ai.afterGenerateContent', (event) => event.id);
