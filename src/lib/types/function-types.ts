import type {
  aiFunctions,
  alertsFunctions,
  databaseFunctions,
  deployDirectories,
  eventarcFunctions,
  firestoreFunctions,
  functionBuilders,
  functions,
  httpsFunctions,
  identityFunctions,
  pubsubFunctions,
  remoteConfigFunctions,
  schedulerFunctions,
  storageFunctions,
  tasksFunctions,
  testLabFunctions,
} from '$constants';

export type DatabaseFunction = (typeof databaseFunctions)[number];

export type FirestoreFunction = (typeof firestoreFunctions)[number];

export type StorageFunction = (typeof storageFunctions)[number];

export type SchedulerFunction = (typeof schedulerFunctions)[number];

export type Function = (typeof functions)[number];

export type HttpsFunction = (typeof httpsFunctions)[number];

export type IdentityFunction = (typeof identityFunctions)[number];

export type PubsubFunction = (typeof pubsubFunctions)[number];

export type TasksFunction = (typeof tasksFunctions)[number];

export type EventarcFunction = (typeof eventarcFunctions)[number];

export type TestLabFunction = (typeof testLabFunctions)[number];

export type RemoteConfigFunction = (typeof remoteConfigFunctions)[number];

export type AlertsFunction = (typeof alertsFunctions)[number];

export type AiFunction = (typeof aiFunctions)[number];

export type DeployFunction = (typeof functions)[number];

export type FunctionBuilder = (typeof functionBuilders)[number];

export type DeployDirectory = (typeof deployDirectories)[number];
