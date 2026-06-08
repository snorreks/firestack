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

export const identityFunctions = [
  'beforeUserCreated',
  'beforeUserSignedIn',
  'beforeEmailSent',
  'beforeSmsSent',
] as const;

export const pubsubFunctions = ['onMessagePublished'] as const;

export const tasksFunctions = ['onTaskDispatched'] as const;

export const eventarcFunctions = ['onCustomEventPublished'] as const;

export const testLabFunctions = ['onTestMatrixCompleted'] as const;

export const remoteConfigFunctions = ['onConfigUpdated'] as const;

export const alertsFunctions = [
  'onPlanUpdatePublished',
  'onPlanAutomatedUpdatePublished',
  'onNewFatalIssuePublished',
  'onNewNonfatalIssuePublished',
  'onRegressionAlertPublished',
  'onStabilityDigestPublished',
  'onVelocityAlertPublished',
  'onNewAnrIssuePublished',
  'onThresholdAlertPublished',
  'onNewTesterIosDevicePublished',
  'onInAppFeedbackPublished',
] as const;

export const aiFunctions = ['beforeGenerateContent', 'afterGenerateContent'] as const;

export const schedulerFunctions = ['onSchedule'] as const;

export const httpsFunctions = ['onCall', 'onRequest', 'onCallZod', 'onRequestZod'] as const;

export const functions = [
  ...aiFunctions,
  ...alertsFunctions,
  ...authFunctions,
  ...databaseFunctions,
  ...eventarcFunctions,
  ...firestoreFunctions,
  ...identityFunctions,
  ...pubsubFunctions,
  ...remoteConfigFunctions,
  ...schedulerFunctions,
  ...storageFunctions,
  ...tasksFunctions,
  ...testLabFunctions,
  ...httpsFunctions,
] as const;
