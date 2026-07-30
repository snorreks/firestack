import type {
  AfterGenerateContentData,
  AIBlockingEvent,
  BeforeGenerateContentData,
} from 'firebase-functions/ai';
import type { AiTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Blocks a request to generate content via Firebase AI.
 * Runs before content generation and can modify or reject the request.
 *
 * @param handler - Handler that receives the blocking event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const beforeGenerateContent = createEventHandler<
  AIBlockingEvent<BeforeGenerateContentData>,
  AiTriggerOptions
>('ai.beforeGenerateContent', (event) => event.id);

/**
 * Handles an event after content is generated via Firebase AI.
 * Useful for logging, post-processing, or triggering side-effects.
 *
 * @param handler - Handler that receives the generated content event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const afterGenerateContent = createEventHandler<
  AIBlockingEvent<AfterGenerateContentData>,
  AiTriggerOptions
>('ai.afterGenerateContent', (event) => event.id);
