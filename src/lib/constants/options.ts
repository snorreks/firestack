import type { NodeVersion } from '$types';

export const DEFAULT_NODE_VERSION: NodeVersion = '24';
export const DEFAULT_REGION = 'us-central1';
export const DEFAULT_EMULATOR_PROJECT_ID = 'demo-project';

// Valid configuration keys for Firebase v2 functions
export const VALID_FIREBASE_OPTIONS = [
  // Global / Instance / Runtime options
  'region',
  'memory',
  'timeoutSeconds',
  'minInstances',
  'maxInstances',
  'vpcConnector',
  'vpcConnectorEgressSettings',
  'serviceAccount',
  'ingressSettings',
  'cpu',
  'labels',
  'secrets',
  'concurrency',
  'invoker',
  'omit',
  'cors',
  'preserveExternalChanges',

  // App Check (HTTP/Callable)
  'enforceAppCheck',
  'consumeAppCheckToken',

  // Scheduled Function triggers
  'schedule',
  'timeZone',
  'retryConfig', // Also used by Task Queues
  'retry', // Used by background events (boolean)
  'failurePolicy', // Used by v1 background events

  // Eventarc / PubSub / Custom events
  'eventFilters',
  'eventFilterPathPatterns',
  'topic',
  'eventType',
  'channel',

  // Firestore triggers
  'document',
  'database', // For multi-database support in v2

  // Realtime Database triggers
  'ref',
  'instance',

  // Storage triggers
  'bucket',

  // Task Queue triggers
  'rateLimits',
] as const;

export const VALID_FIRESTACK_OPTIONS = [
  'functionName',
  'nodeVersion',
  'assets',
  'external',
  'validationStrategy',
] as const;
