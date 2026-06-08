import { onTaskDispatched } from '@snorreks/firestack';

/**
 * Task Queue — processes tasks dispatched from Google Cloud Tasks.
 *
 * Access the task payload via `request.data`, auth via `request.auth`,
 * and scheduling metadata directly on the request (retryCount, queueName, etc.).
 */
export default onTaskDispatched(
  (request) => {
    console.log('Task dispatched', {
      queueName: request.queueName,
      retryCount: request.retryCount,
      scheduledTime: request.scheduledTime,
      payload: request.data,
    });

    return {
      processed: true,
    };
  },
  {
    timeoutSeconds: 1800,
    functionName: 'tasks_example',
  }
);
