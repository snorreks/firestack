import { onCustomEventPublished } from '@snorreks/firestack';

/**
 * Eventarc — handles custom events published through Eventarc triggers.
 *
 * The event type and optional channel/filters are specified in options.
 * The handler receives the CloudEvent with typed data.
 */
export default onCustomEventPublished(
  (event) => {
    console.log('Custom event received', {
      eventType: event.type,
      eventId: event.id,
      data: event.data,
    });

    return {
      acknowledged: true,
      eventId: event.id,
    };
  },
  {
    eventType: 'com.example.custom-event',
    filters: {
      environment: 'production',
    },
    timeoutSeconds: 540,
    functionName: 'eventarc_example',
  }
);
