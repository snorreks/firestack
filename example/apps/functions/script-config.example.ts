import process from 'node:process';

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: '',
  private_key:
    '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n',
  client_email: '',
});

export const config = {};
