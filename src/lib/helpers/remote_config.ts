import type { ConfigUpdateData } from 'firebase-functions/remoteConfig';
import type { CloudEvent } from 'firebase-functions/v2';
import type { RemoteConfigTriggerOptions } from '$types';
import { createEventHandler } from './factory.ts';

export const onConfigUpdated = createEventHandler<
  CloudEvent<ConfigUpdateData>,
  RemoteConfigTriggerOptions
>('remoteConfig.onConfigUpdated', (event) => event.id);
