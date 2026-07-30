import type { ConfigUpdateData } from 'firebase-functions/remoteConfig';
import type { CloudEvent } from 'firebase-functions/v2';
import type { RemoteConfigTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

/**
 * Handles a Remote Config update event.
 * Triggered when a Firebase Remote Config template is updated.
 *
 * @param handler - Handler that receives the cloud event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onConfigUpdated = createEventHandler<
  CloudEvent<ConfigUpdateData>,
  RemoteConfigTriggerOptions
>('remoteConfig.onConfigUpdated', (event) => event.id);
