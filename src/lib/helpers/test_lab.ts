import type { TestMatrixCompletedData } from 'firebase-functions/testLab';
import type { CloudEvent } from 'firebase-functions/v2';
import type { TestLabTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a Test Lab test matrix completion event.
 *
 * @param handler - Handler that receives the cloud event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onTestMatrixCompleted = createEventHandler<
  CloudEvent<TestMatrixCompletedData>,
  TestLabTriggerOptions
>('testLab.onTestMatrixCompleted', (event) => event.id);
