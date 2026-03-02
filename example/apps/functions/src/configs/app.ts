import process from 'node:process';
import {
  type AppOptions,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';

const parseServiceAccount = (serviceAccountString: string): ServiceAccount => {
  try {
    // The JSON parser will handle the \n characters correctly on its own.
    const parsed = JSON.parse(serviceAccountString) as ServiceAccount;
    // Fix the private key newlines
    if (parsed.privateKey) {
      parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    console.error('parseServiceAccount', error);
    throw error;
  }
};

const getApp = () => {
  const app = getApps()[0];
  if (app) {
    return app;
  }

  const serviceAccountString = process.env['FIREBASE_SERVICE_ACCOUNT'];

  const options: AppOptions = {};

  if (serviceAccountString) {
    options.credential = cert(parseServiceAccount(serviceAccountString));
  }

  const projectId = process.env['GCP_PROJECT_ID'];

  if (projectId) {
    options.storageBucket = `${projectId}.firebasestorage.app`;
    options.projectId = projectId;
  }

  return initializeApp(options);
};

export { getApp };
