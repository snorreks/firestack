export type FirebaseEmulator =
  | 'auth'
  | 'functions'
  | 'firestore'
  | 'database'
  | 'hosting'
  | 'pubsub'
  | 'storage'
  | 'eventarc'
  | 'extensions'
  | 'ui'
  | 'hub'
  | 'emulatorHub' // Legacy alias used by Aikami's EMULATOR_PORTS constant set
  | 'logging'
  | 'appcheck'
  | 'dataconnect';
