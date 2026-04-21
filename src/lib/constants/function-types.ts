export const firestoreFunctions = [
  'onCreated',
  'onUpdated',
  'onDeleted',
  'onWritten',
  'onDocumentCreated',
  'onDocumentUpdated',
  'onDocumentDeleted',
  'onDocumentWritten',
  'onCreatedZod',
  'onUpdatedZod',
  'onDeletedZod',
  'onWrittenZod',
] as const;

export const databaseFunctions = [
  'onValueCreated',
  'onValueDeleted',
  'onValueUpdated',
  'onValueWritten',
] as const;

export const storageFunctions = [
  'onObjectArchived',
  'onObjectDeleted',
  'onObjectFinalized',
  'onObjectMetadataUpdated',
] as const;

export const authFunctions = [
  'onAuthCreate',
  'onAuthDelete',
  'beforeAuthCreate',
  'beforeAuthSignIn',
] as const;

export const schedulerFunctions = ['onSchedule'] as const;

export const httpsFunctions = ['onCall', 'onRequest', 'onCallZod', 'onRequestZod'] as const;

export const functions = [
  ...authFunctions,
  ...databaseFunctions,
  ...firestoreFunctions,
  ...storageFunctions,
  ...schedulerFunctions,
  ...httpsFunctions,
] as const;
