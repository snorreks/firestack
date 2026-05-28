import {
  type Firestore,
  initializeFirestore as fbInitializeFirestore,
} from 'firebase-admin/firestore';
import { getApp } from './app.ts';

// import { getEnvironmentValue } from './environment.ts';

let _database: Firestore | undefined;

export const getFirestore = (): Firestore => {
  if (_database) {
    return _database;
  }
  const app = getApp();
  _database = fbInitializeFirestore(app, { preferRest: true });

  return _database;
};
