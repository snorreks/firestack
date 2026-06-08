import type { TestMatrixCompletedData } from 'firebase-functions/testLab';
import type { CloudEvent } from 'firebase-functions/v2';
import type { TestLabTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onTestMatrixCompleted = createEventHandler<
  CloudEvent<TestMatrixCompletedData>,
  TestLabTriggerOptions
>('testLab.onTestMatrixCompleted', (event) => event.id);
