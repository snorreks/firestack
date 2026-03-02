// bunfire/src/lib/types/firebase-auth-v2.d.ts

import type { AuthUserRecord } from 'firebase-functions/v2/identity';

export interface AuthEventContext {
  eventId: string;
  eventType: string;
  resource: string;
  timestamp: string;
  params: { [key: string]: string };
  auth: {
    token: object;
    uid: string;
  };
  data: AuthUserRecord;
}

export interface BeforeCreateResponse {
  customClaims?: object;
  disabled?: boolean;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  phoneNumber?: string;
  photoURL?: string;
}

export interface BeforeSignInResponse {
  customClaims?: object;
  sessionClaims?: object;
}
