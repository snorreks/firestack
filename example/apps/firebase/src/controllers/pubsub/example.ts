import { onMessagePublished } from '@snorreks/firestack';

/**
 * Pub/Sub — reacts to messages published to a topic.
 *
 * Each message's JSON payload is parsed and processed. Batch-queued
 * side effects run concurrently after the handler returns.
 */
export default onMessagePublished(
  (event) => {
    const message = event.data.message;

    console.log('Pub/Sub message received', {
      messageId: message.messageId,
      publishTime: message.publishTime,
      data: message.json,
    });

    return {
      processed: true,
      messageId: message.messageId,
    };
  },
  {
    topic: 'example-topic',
    timeoutSeconds: 540,
    functionName: 'pubsub_example',
  }
);
