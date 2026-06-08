import { onConfigUpdated } from '@snorreks/firestack';

/**
 * Remote Config — reacts when a Remote Config template is updated.
 *
 * The event carries the version number, update time, update user,
 * and update origin/type for audit trails or cascading config syncs.
 */
export default onConfigUpdated(
  (event) => {
    console.log('Remote Config updated', {
      versionNumber: event.data.versionNumber,
      updateTime: event.data.updateTime,
      updateUser: event.data.updateUser,
      updateOrigin: event.data.updateOrigin,
      updateType: event.data.updateType,
    });

    return {
      processed: true,
      versionNumber: event.data.versionNumber,
    };
  },
  {
    timeoutSeconds: 540,
    functionName: 'remote_config_example',
  }
);
